export type EvidenceSource = {
  id: string;
  type: "pubmed";
  title: string;
  authors: string;
  journal: string;
  publishedAt: string;
  abstract: string;
  url: string;
};

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";

function textOf(node: Element | null, tag: string): string {
  return node?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
}

/** Europe PMC provides a CORS-friendly abstract endpoint and acts as a resilient
 * fallback when browser access to NCBI E-utilities is blocked by network policy. */
async function searchEuropePmc(term: string, maxResults: number): Promise<EvidenceSource[]> {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.search = new URLSearchParams({
    query: term + " AND (SRC:MED OR (SRC:PMC AND HAS_ABSTRACT:Y))",
    format: "json", pageSize: String(Math.min(Math.max(maxResults, 1), 10)),
    resultType: "core", sort: "RELEVANCE",
  }).toString();
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error("Europe PMC fallback failed (" + response.status + ").");
  const data = await response.json();
  const records = Array.isArray(data?.resultList?.result) ? data.resultList.result : [];
  return records.filter((item: any) => item.pmid).map((item: any): EvidenceSource => ({
    id: "S" + String(item.pmid), type: "pubmed",
    title: String(item.title || "Untitled PubMed record").replace(/<[^>]+>/g, ""),
    authors: String(item.authorString || "Authors not listed"),
    journal: String(item.journalTitle || item.journalInfo?.journal?.title || "Journal not listed"),
    publishedAt: String(item.firstPublicationDate || item.pubYear || "Date not listed"),
    abstract: String(item.abstractText || "No abstract available in PubMed."),
    url: "https://pubmed.ncbi.nlm.nih.gov/" + item.pmid + "/",
  })).filter((item: EvidenceSource) => item.abstract !== "No abstract available in PubMed.");
}

/** Search PubMed through NCBI first, then fall back to Europe PMC when
 * E-utilities is blocked, rate-limited, or returns no usable abstracts. */
export async function searchPubMedEvidence(query: string, maxResults = 8): Promise<EvidenceSource[]> {
  const term = query.trim();
  if (!term) return [];
  const limit = Math.min(Math.max(maxResults, 1), 10);
  let ncbiFailure = "";
  try {
    const searchUrl = new URL(EUTILS + "esearch.fcgi");
    searchUrl.search = new URLSearchParams({
      db: "pubmed", term, retmax: String(limit), retmode: "json", sort: "relevance",
      
    }).toString();
    const searchResponse = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(15000) });
    if (!searchResponse.ok) throw new Error("PubMed search returned HTTP " + searchResponse.status + ".");
    const searchJson = await searchResponse.json();
    const ids: string[] = searchJson?.esearchresult?.idlist || [];
    if (ids.length) {
      const fetchUrl = new URL(EUTILS + "efetch.fcgi");
      fetchUrl.search = new URLSearchParams({
        db: "pubmed", id: ids.join(","), retmode: "xml",
        
      }).toString();
      const fetchResponse = await fetch(fetchUrl.toString(), { signal: AbortSignal.timeout(18000) });
      if (!fetchResponse.ok) throw new Error("PubMed abstract retrieval returned HTTP " + fetchResponse.status + ".");
      const xmlText = await fetchResponse.text();
      const xml = new DOMParser().parseFromString(xmlText, "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("PubMed returned malformed XML.");
      const records = Array.from(xml.querySelectorAll("PubmedArticle")).map((article): EvidenceSource => {
        const pmid = textOf(article, "PMID");
        const title = textOf(article, "ArticleTitle").replace(/\\s+/g, " ");
        const journal = textOf(article, "Title");
        const year = textOf(article, "Year") || textOf(article, "PubDate");
        const authorNodes = Array.from(article.querySelectorAll("AuthorList Author")).slice(0, 3);
        const authors = authorNodes.map((author) => [textOf(author, "LastName"), textOf(author, "Initials")].filter(Boolean).join(" ")).filter(Boolean).join(", ");
        const abstract = Array.from(article.querySelectorAll("Abstract AbstractText")).map((node) => {
          const label = node.getAttribute("Label");
          return (label ? label + ": " : "") + (node.textContent || "").trim();
        }).filter(Boolean).join("\\n");
        return {
          id: "S" + pmid, type: "pubmed", title: title || "Untitled PubMed record",
          authors: authors || "Authors not listed", journal: journal || "Journal not listed",
          publishedAt: year || "Date not listed", abstract: abstract || "No abstract available in PubMed.",
          url: "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/",
        };
      }).filter((source) => source.id !== "S" && source.abstract !== "No abstract available in PubMed.");
      if (records.length) return records;
      ncbiFailure = ids.length ? "PubMed returned records but no abstracts were available." : "PubMed returned no matching records.";
    } else {
      ncbiFailure = "PubMed returned no matching records.";
    }
  } catch (error) {
    ncbiFailure = error instanceof Error ? error.message : "PubMed request failed.";
  }

  try {
    const fallback = await searchEuropePmc(term, limit);
    if (fallback.length) return fallback;
    throw new Error("Europe PMC returned no records with abstracts.");
  } catch (error) {
    const fallbackError = error instanceof Error ? error.message : "Europe PMC request failed.";
    throw new Error("Could not retrieve biomedical abstracts. NCBI: " + ncbiFailure + " Europe PMC: " + fallbackError + " Check network access or retry with a broader search.");
  }
}

export type GuidelinePortal = { name: string; region: string; url: string; note: string };

export function getGuidelinePortals(query: string): GuidelinePortal[] {
  const q = encodeURIComponent(query.trim());
  return [
    { name: "WHO publications", region: "Global", url: "https://www.who.int/publications/i?search=" + q, note: "Check document date, scope and applicable population." },
    { name: "NICE guidance", region: "United Kingdom", url: "https://www.nice.org.uk/search?q=" + q, note: "National guideline portal; applicability may vary by country." },
    { name: "CDC", region: "United States", url: "https://search.cdc.gov/search/?query=" + q, note: "Public-health and US-specific guidance." },
    { name: "GINA", region: "Global · asthma", url: "https://ginasthma.org/", note: "Asthma strategy reports and updates." },
    { name: "Nepal Department of Health Services", region: "Nepal", url: "https://www.dohs.gov.np/", note: "Check Nepal-specific programme and national guidance." },
    { name: "India MoHFW", region: "India · South Asia", url: "https://www.mohfw.gov.in/", note: "Official national guidance and programmes." },
  ];
}
