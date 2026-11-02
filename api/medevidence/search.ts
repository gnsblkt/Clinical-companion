type EvidenceSource = {
  id: string;
  title: string;
  authors: string;
  journal: string;
  publishedAt: string;
  abstract: string;
  url: string;
  pmid: string;
  sourceType: "pubmed";
  accessLevel: "abstract" | "metadata";
};

type ApiRequest = { question?: unknown; locale?: unknown; context?: unknown };

const MAX_QUESTION_LENGTH = 500;
const MAX_SOURCES = 8;
const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function clean(value: unknown, max = 4000): string {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function retrieveEvidence(question: string): Promise<EvidenceSource[]> {
  const url = new URL(EUROPE_PMC);
  url.search = new URLSearchParams({
    query: question + " AND (SRC:MED OR (SRC:PMC AND HAS_ABSTRACT:Y))",
    format: "json",
    pageSize: String(MAX_SOURCES),
    resultType: "core",
    sort: "RELEVANCE",
  }).toString();

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Biomedical evidence retrieval is temporarily unavailable.");
  const payload: any = await response.json();
  const records = Array.isArray(payload?.resultList?.result) ? payload.resultList.result : [];

  const seen = new Set<string>();
  return records.filter((item: any) => item?.pmid && item?.abstractText).map((item: any): EvidenceSource => {
    const pmid = clean(item.pmid, 30);
    return {
      id: "S" + pmid,
      pmid,
      title: clean(item.title || "Untitled PubMed record", 500),
      authors: clean(item.authorString || "Authors not listed", 500),
      journal: clean(item.journalTitle || item.journalInfo?.journal?.title || "Journal not listed", 300),
      publishedAt: clean(item.firstPublicationDate || item.pubYear || "Date not listed", 40),
      abstract: clean(item.abstractText, 12000),
      url: "https://pubmed.ncbi.nlm.nih.gov/" + encodeURIComponent(pmid) + "/",
      sourceType: "pubmed",
      accessLevel: "abstract",
    };
  }).filter((source: EvidenceSource) => {
    if (!source.pmid || seen.has(source.pmid)) return false;
    seen.add(source.pmid);
    return true;
  }).slice(0, MAX_SOURCES);
}

function buildPrompt(question: string, sources: EvidenceSource[]) {
  const context = sources.map((source) =>
    "[" + source.id + "] PMID " + source.pmid +
    "\nTitle: " + source.title +
    "\nAuthors: " + source.authors +
    "\nJournal/date: " + source.journal + " · " + source.publishedAt +
    "\nAbstract: " + source.abstract
  ).join("\n\n");

  return {
    system: [
      "You are MedEvidence, an evidence-grounded medical education assistant.",
      "Answer the exact question directly. The only retrieved research evidence available to you is the abstract and metadata supplied in the user message.",
      "Cite each material research claim inline using only the supplied source IDs exactly as [S123456]. Never invent references, PMIDs, study designs, findings, dates, effect sizes, guideline recommendations or certainty grades.",
      "Use a clear structure suited to the question: direct answer, evidence summary, important limitations or conflicting findings, and practical interpretation of the evidence.",
      "Distinguish guidelines from research studies only when the source itself establishes that it is an official guideline. These retrieved records are PubMed-indexed abstracts, not automatically guidelines.",
      "Do not claim to have reviewed full text. State that the synthesis is abstract-based. If evidence is insufficient or indirect, say so.",
      "Do not provide patient-specific diagnosis, prescriptions, medication doses or treatment orders. This is an educational evidence-discovery tool, not clinical decision support.",
      "Do not make a citation unless the supplied abstract supports the associated claim. If no source supports a point, label it as general background or omit it."
    ].join("\n"),
    user: "Medical question: " + question + "\n\nRetrieved records (abstracts and metadata only):\n" + context,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  const body = (req.body || {}) as ApiRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return send(res, 400, { error: "Enter a medical question of 1–500 characters." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return send(res, 503, { error: "MedEvidence AI service is not configured yet. The server administrator must configure GROQ_API_KEY." });

  try {
    const sources = await retrieveEvidence(question);
    if (!sources.length) return send(res, 200, {
      answerMarkdown: "No PubMed-indexed abstracts with usable abstracts were found for this query. Try a more focused question or different terminology.",
      sources: [],
      limitations: ["No eligible abstracts were retrieved; no AI synthesis was generated."],
      generatedAt: new Date().toISOString(),
      disclaimer: "Educational evidence discovery only; not a substitute for professional judgement.",
    });

    const prompt = buildPrompt(question, sources);
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        max_completion_tokens: 4096,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!aiResponse.ok) {
      const providerMessage = aiResponse.status === 429 ? "The AI service is busy. Please retry shortly." : "The AI service could not generate an answer.";
      return send(res, 502, { error: providerMessage });
    }

    const aiPayload: any = await aiResponse.json();
    const raw = aiPayload?.choices?.[0]?.message?.content;
    const answerMarkdown = Array.isArray(raw)
      ? raw.map((part: any) => typeof part === "string" ? part : part?.text || "").join("\n").trim()
      : typeof raw === "string" ? raw.trim() : "";

    if (!answerMarkdown) return send(res, 502, { error: "The AI provider returned no readable answer. Please retry." });

    const allowed = new Set(sources.map((source) => source.id));
    const cited = Array.from(answerMarkdown.matchAll(/\[(S\d+)\]/g)).map((match) => match[1]);
    const invalidCitations = Array.from(new Set(cited.filter((id) => !allowed.has(id))));
    const safeAnswer = answerMarkdown.replace(/\[(S\d+)\]/g, (marker, id: string) =>
      allowed.has(id) ? marker : "**[Unverified citation removed: " + id + "]**"
    );

    return send(res, 200, {
      answerMarkdown: safeAnswer,
      sources,
      limitations: [
        "Synthesis is based on retrieved abstracts and bibliographic metadata, not necessarily full-text articles.",
        "A valid citation identifier does not by itself prove that a cited paper fully supports every associated claim.",
        ...(invalidCitations.length ? ["The model generated citation identifiers not present in the retrieved source set; these were flagged."] : []),
      ],
      generatedAt: new Date().toISOString(),
      disclaimer: "Educational evidence discovery only; not a substitute for professional judgement.",
    });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : "Evidence search failed. Please retry." });
  }
}
