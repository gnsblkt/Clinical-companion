import React, { useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EvidenceSource } from "../api/evidenceSearch";

type Provider = "groq" | "openai" | "openrouter" | "gemini";

const providerConfig: Record<Provider, { label: string; endpoint: string; model: string }> = {
  groq: { label: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  openai: { label: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  openrouter: { label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
  gemini: { label: "Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/", model: "gemini-2.5-flash" },
};

type Props = { topic: string; sources: EvidenceSource[] };

export default function EvidenceTutor({ topic, sources }: Props) {
  const [provider, setProvider] = useState<Provider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(providerConfig.groq.model);
  const [question, setQuestion] = useState("Explain this topic for postgraduate medical exam revision. Highlight mechanisms, important distinctions, limitations and exam pearls.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const citationIds = useMemo(() => Array.from(answer.matchAll(/\\[(S\\d+)\\]/g)).map((match) => match[1]), [answer]);
  const invalidCitationIds = useMemo(() => Array.from(new Set(citationIds.filter((id) => !sourceMap.has(id)))), [citationIds, sourceMap]);
  const renderedAnswer = useMemo(() => answer.replace(/\\[(S\\d+)\\]/g, (match, id: string) => {
    const source = sourceMap.get(id);
    return source ? "[" + id + "](" + source.url + ")" : "**[Unverified citation: " + id + "]**";
  }), [answer, sourceMap]);

  function changeProvider(next: Provider) {
    setProvider(next);
    setModel(providerConfig[next].model);
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() || !question.trim() || loading) return;
    if (!sources.length) {
      setError("Search PubMed first so the tutor has retrieved evidence to work from.");
      return;
    }
    setLoading(true);
    setError("");
    setAnswer("");
    const sourceContext = sources.map((source) =>
      "[" + source.id + "] PMID " + source.id.slice(1) + "\nTitle: " + source.title +
      "\nAuthors: " + source.authors + "\nJournal/date: " + source.journal + " · " + source.publishedAt +
      "\nAbstract: " + source.abstract + "\nURL: " + source.url
    ).join("\n\n");

    const system = [
      "You are MedAtlas, a medical education tutor. This is educational synthesis, never clinical decision support.",
      "Use only the supplied retrieved PubMed metadata and abstracts for claims presented as source-supported. General explanations may be included but label them as background knowledge and state that they are not independently source-verified.",
      "Do not invent references, publication details, study findings, guidelines, or citations. Cite relevant supplied sources inline using exactly their IDs such as [S1]. Do not cite a source unless its supplied content supports the sentence.",
      "If evidence is absent, contradictory, outdated, abstract-only, or insufficient, say so plainly. Do not pretend you reviewed full text or a guideline if only an abstract or link is supplied.",
      "Return Markdown with headings: Educational disclaimer; Short answer; Structured explanation; Exam / learning pearls; Uncertainty and limitations; Sources used.",
      "Include an educational-only disclaimer and encourage verification against current official guidance. Avoid patient-specific diagnosis, orders, or treatment recommendations.",
    ].join("\n");

    try {
      const userPrompt = "Topic: " + topic + "\n\nQuestion: " + question + "\n\nRetrieved evidence (abstract/metadata only):\n" + sourceContext;
      const isGemini = provider === "gemini";
      const response = await fetch(isGemini
        ? providerConfig.gemini.endpoint + encodeURIComponent(model.trim() || providerConfig.gemini.model) + ":generateContent?key=" + encodeURIComponent(apiKey.trim())
        : providerConfig[provider].endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(!isGemini ? { Authorization: "Bearer " + apiKey.trim(),
          ...(provider === "openrouter" ? { "HTTP-Referer": window.location.origin, "X-Title": "MedAtlas" } : {}) } : {}) },
        body: JSON.stringify(isGemini
          ? { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], generationConfig: { temperature: 0.2 } }
          : { model: model.trim() || providerConfig[provider].model, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "AI request failed (" + response.status + ").");
      const content = isGemini ? data?.candidates?.[0]?.content?.parts?.map((part: {text?: string}) => part.text || "").join("\n") : data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("AI provider returned an empty answer.");
      setAnswer(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the selected AI provider.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="medatlas-evidence-tutor" id="evidence-tutor">
    <div className="medatlas-evidence-tutor-head">
      <div><span className="medatlas-evidence-kicker">EVIDENCE-GROUNDED TUTOR</span><h3>Ask MedAtlas about the evidence</h3><p>AI synthesis from the abstracts and metadata retrieved in this search.</p></div>
      <span className="medatlas-evidence-count">{sources.length} sources</span>
    </div>
    <div className="medatlas-evidence-safety"><strong>Evidence boundary</strong> Abstracts and bibliographic metadata are supplied to the AI—not full-text papers or complete guideline documents. Citation links identify source records; independently verify that each cited source supports the specific claim.</div>
    <form onSubmit={ask} className="medatlas-evidence-form">
      <div className="medatlas-evidence-form-row">
        <label>AI provider<select value={provider} onChange={(e) => changeProvider(e.target.value as Provider)}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="gemini">Gemini</option></select></label>
        <label>Model<input value={model} onChange={(e) => setModel(e.target.value)} placeholder={providerConfig[provider].model}/></label>
      </div>
      <label>Your API key (session only)<input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your own provider key" required/></label>
      <label>Question<textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={4000} required/></label>
      <div className="medatlas-evidence-actions"><button type="submit" disabled={loading || !apiKey.trim() || !sources.length}>{loading ? "Synthesizing evidence…" : "Generate evidence-aware answer"}</button><span>Key remains in component memory and is not saved to localStorage.</span></div>
    </form>
    {error && <div className="medatlas-evidence-error" role="alert">{error}</div>}
    {answer && <div className="medatlas-evidence-answer">
      <div className="medatlas-evidence-answer-head"><strong>Educational synthesis</strong><span>Not clinical advice or decision support</span></div>
      {invalidCitationIds.length > 0 && <div className="medatlas-evidence-error" role="alert"><strong>Unverified citation markers:</strong> {invalidCitationIds.join(", ")}. These IDs do not match the retrieved PubMed sources and must not be treated as valid references.</div>}\n      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{a: ({href, children, ...props}) => <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>}}>{renderedAnswer}</ReactMarkdown>
      <details className="medatlas-how-built"><summary>How this answer was built</summary><ol><li>PubMed was searched for the topic.</li><li>The selected provider received these retrieved abstracts and metadata.</li><li>The model generated an educational synthesis and was instructed to cite supplied source IDs.</li><li>Citations are links to PubMed records, not proof that the sentence is supported; check the article and full text.</li></ol><p>Retrieved: {sources.length} PubMed records. Provider: {provider}. Model: {model || providerConfig[provider].model}.</p></details>
      <div className="medatlas-used-sources"><h4>Retrieved sources available to this answer</h4>{sources.map((source) => <article key={source.id}><b>[{source.id}]</b> <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.journal} · {source.publishedAt} · {source.authors}</small></article>)}</div>
    </div>}
    <p className="medatlas-evidence-footnote">Educational use only. Do not use AI-generated content to diagnose, prescribe, triage, or make patient-care decisions. Confirm important facts in current official guidelines and primary literature.</p>
  </section>;
}
