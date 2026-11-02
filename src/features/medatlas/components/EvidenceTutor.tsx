import React, { useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EvidenceSource } from "../api/evidenceSearch";
import { AI_PROVIDERS, generateAIText, readAIConfig, saveAIConfig, testAIConnection, type AIProvider } from "../api/aiProvider";

type Props = { topic: string; sources: EvidenceSource[] };

export default function EvidenceTutor({ topic, sources }: Props) {
  const initial = readAIConfig();
  const [provider, setProvider] = useState<AIProvider>(initial.provider);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [question, setQuestion] = useState("Explain the topic using the retrieved evidence. Summarise the strongest findings, clinical or educational implications, important uncertainties, and postgraduate exam pearls. Do not invent guideline recommendations.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const citationIds = useMemo(() => Array.from(answer.matchAll(/\[(S\d+)\]/g)).map((match) => match[1]), [answer]);
  const invalidCitationIds = useMemo(() => Array.from(new Set(citationIds.filter((id) => !sourceMap.has(id)))), [citationIds, sourceMap]);
  const renderedAnswer = useMemo(() => answer.replace(/\[(S\d+)\]/g, (match, id: string) => {
    const source = sourceMap.get(id);
    return source ? "[" + id + "](" + source.url + ")" : "**[Unverified citation: " + id + "]**";
  }), [answer, sourceMap]);

  function changeProvider(next: AIProvider) {
    setProvider(next);
    setModel(AI_PROVIDERS[next].model);
    setStatus("");
  }

  function config() {
    return { provider, apiKey: apiKey.trim(), model: model.trim() || AI_PROVIDERS[provider].model };
  }

  function saveSettings() {
    try {
      saveAIConfig(config());
      setStatus("AI settings saved for this browser session. They are shared with AI Study Chat.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save AI settings.");
    }
  }

  async function testConnection() {
    if (!apiKey.trim() || testing) return;
    setTesting(true); setError(""); setStatus("");
    try {
      await testAIConnection(config());
      saveAIConfig(config());
      setStatus("Connection successful. Settings saved for this browser session.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() || !question.trim() || loading) return;
    if (!sources.length) {
      setError("No PubMed abstracts were retrieved for this search. Try a broader topic or check your connection.");
      return;
    }
    setLoading(true); setError(""); setStatus(""); setAnswer("");
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
      "Return Markdown with headings: Educational disclaimer; Short answer; Structured explanation; Claim-level evidence review; Exam / learning pearls; Uncertainty and limitations; Sources used.",
      "In Claim-level evidence review, make a compact table with columns: Claim (brief); cited source ID(s); evidence support (Supported by abstract / Partial / Not found in supplied abstract / Conflicting / Unable to assess); reason and limitations. Evaluate only claims made in the answer that materially affect medical understanding. Cite the supplied abstract content, not merely its title. If abstract text does not directly support a claim, say Not found in supplied abstract. Do not call this independent verification.",
      "Add publication year/date for cited sources where available and flag older evidence when relevance may have changed. Separate primary studies, reviews/meta-analyses, and guideline documents when source type can be determined from supplied metadata. Do not label a PubMed abstract as a guideline unless the record clearly identifies it as one.",
      "Include an educational-only disclaimer and encourage verification against current official guidance. Avoid patient-specific diagnosis, orders, or treatment recommendations.",
    ].join("\n");

    try {
      const userPrompt = "Topic: " + topic + "\n\nQuestion: " + question + "\n\nRetrieved evidence (abstract/metadata only):\n" + sourceContext;
      const content = await generateAIText(config(), system, userPrompt, 2200);
      setAnswer(content);
      saveAIConfig(config());
      setStatus("Answer generated using " + sources.length + " retrieved PubMed records (abstracts/metadata only).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the selected AI provider.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="medatlas-evidence-tutor" id="evidence-tutor">
    <div className="medatlas-evidence-tutor-head">
      <div><span className="medatlas-evidence-kicker">MEDATLAS · EVIDENCE-FIRST AI</span><h3>Ask a medical question. Get a cited answer.</h3><p>The tutor comes first. Retrieved biomedical literature and guideline records below let you inspect the evidence behind its answer.</p></div>
      <span className="medatlas-evidence-count">{sources.length} sources</span>
    </div>
    <div className="medatlas-evidence-safety"><strong>Evidence boundary</strong> Abstracts and bibliographic metadata are supplied to the AI—not full-text papers or complete guideline documents. Citation links identify source records; independently verify that each cited source supports the specific claim.</div>
    {!sources.length && <div className="medatlas-evidence-error" role="status">No evidence records are currently available to the tutor. Run a PubMed search first. If this persists, check whether PubMed abstract retrieval is blocked by your network.</div>}
    <form onSubmit={ask} className="medatlas-evidence-form">
      <div className="medatlas-evidence-form-row">
        <label>AI provider<select value={provider} onChange={(e) => changeProvider(e.target.value as AIProvider)}>{(Object.keys(AI_PROVIDERS) as AIProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDERS[key].label}</option>)}</select></label>
        <label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{AI_PROVIDERS[provider].models.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <label>Provider API key<input type="password" autoComplete="off" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setStatus(""); }} placeholder="Paste your provider API key" required/></label>
      <div className="medatlas-evidence-actions medatlas-ai-config-actions">
        <button type="button" className="medatlas-ai-secondary" onClick={saveSettings} disabled={!apiKey.trim()}>Save AI settings</button>
        <button type="button" className="medatlas-ai-secondary" onClick={testConnection} disabled={!apiKey.trim() || testing}>{testing ? "Testing…" : "Test connection"}</button>
        <button type="submit" disabled={loading || !apiKey.trim() || !sources.length}>{loading ? "Synthesizing evidence…" : "Generate cited answer"}</button>
      </div>
      <span className="medatlas-evidence-session-note">API key is kept in browser session storage, not synced or saved to the MedAtlas account. Never use a shared/public device for personal API credentials.</span>
    </form>
    {error && <div className="medatlas-evidence-error" role="alert">{error}</div>}
    {status && <div className="medatlas-evidence-status" role="status">{status}</div>}
    {answer && <div className="medatlas-evidence-answer">
      <div className="medatlas-evidence-answer-head"><strong>Evidence-linked educational answer</strong><span>AI appraisal · verify against original sources</span><span>Not clinical advice or decision support</span></div>
      {invalidCitationIds.length > 0 && <div className="medatlas-evidence-error" role="alert"><strong>Unverified citation markers:</strong> {invalidCitationIds.join(", ")}. These IDs do not match the retrieved PubMed sources and must not be treated as valid references.</div>}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{a: ({href, children, ...props}) => <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>}}>{renderedAnswer}</ReactMarkdown>
      <details className="medatlas-how-built"><summary>How this answer was built</summary><ol><li>PubMed was searched for the topic.</li><li>The selected provider received these retrieved abstracts and metadata.</li><li>The model generated an educational synthesis and was instructed to cite supplied source IDs.</li><li>The claim-level table is an AI assessment of the supplied abstracts—not independent source verification, full-text appraisal, or clinical validation. Check cited articles directly.</li></ol><p>Retrieved: {sources.length} PubMed records. Provider: {provider}. Model: {model || AI_PROVIDERS[provider].model}.</p></details>
      <div className="medatlas-used-sources"><h4>Biomedical literature supplied to the tutor</h4>{sources.map((source) => <article key={source.id}><b>[{source.id}]</b> <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.journal} · {source.publishedAt} · {source.authors}</small></article>)}</div>
    </div>}
    <p className="medatlas-evidence-footnote">Educational use only. Do not use AI-generated content to diagnose, prescribe, triage, or make patient-care decisions. Confirm important facts in current official guidelines and primary literature.</p>
  </section>;
}
