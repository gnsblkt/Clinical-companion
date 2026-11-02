import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EvidenceSource } from "../api/evidenceSearch";
import { AI_PROVIDERS, generateAIText, readAIConfig, saveAIConfig, testAIConnection, type AIProvider } from "../api/aiProvider";

type Props = { topic: string; sources: EvidenceSource[]; searching?: boolean; retrievalError?: string };

export default function EvidenceTutor({ topic, sources, searching = false, retrievalError = "" }: Props) {
  const initial = readAIConfig();
  const [provider, setProvider] = useState<AIProvider>(initial.provider);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestKey = useRef("");

  const sourceMap = useMemo(() => new Map(sources.map((source, index) => [source.id, { source, number: index + 1 }])), [sources]);
  const citationIds = useMemo(() => Array.from(answer.matchAll(/\[(S\d+)\]/g)).map((match) => match[1]), [answer]);
  const invalidCitationIds = useMemo(() => Array.from(new Set(citationIds.filter((id) => !sourceMap.has(id)))), [citationIds, sourceMap]);
  const renderedAnswer = useMemo(() => answer.replace(/\[(S\d+)\]/g, (match, id: string) => {
    const entry = sourceMap.get(id);
    return entry ? "[" + entry.number + "](#" + encodeURIComponent("medatlas-source-" + entry.number) + ")" : "**[Unverified citation: " + id + "]**";
  }), [answer, sourceMap]);

  function config() {
    return { provider, apiKey: apiKey.trim(), model: model.trim() || AI_PROVIDERS[provider].model };
  }

  function changeProvider(next: AIProvider) {
    setProvider(next);
    setModel(AI_PROVIDERS[next].model);
    setStatus("");
  }

  function saveSettings() {
    try {
      saveAIConfig(config());
      setStatus("AI settings saved for this browser session.");
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
      setStatus("AI connection successful. Settings saved for this browser session.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    if (searching || !sources.length) return;
    if (!apiKey.trim()) {
      setStatus("Add an AI provider key in AI settings to generate your cited answer automatically.");
      return;
    }
    const signature = topic + "|" + provider + "|" + model + "|" + sources.map((source) => source.id).join(",");
    if (requestKey.current === signature) return;
    requestKey.current = signature;
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(""); setStatus("Evidence retrieved. Generating your cited answer…"); setAnswer("");
      const sourceContext = sources.map((source) =>
        "[" + source.id + "] PMID " + source.id.replace(/^S/, "") +
        "\nTitle: " + source.title +
        "\nAuthors: " + source.authors +
        "\nJournal/date: " + source.journal + " · " + source.publishedAt +
        "\nAbstract: " + source.abstract +
        "\nURL: " + source.url
      ).join("\n\n");
      const system = [
        "You are MedAtlas, an evidence-grounded medical education tutor. This is educational synthesis, never clinical decision support.",
        "Answer the user's actual question directly and immediately. Use the supplied retrieved records as the primary evidence base. Do not make the user search again or ask them to press a second generate button.",
        "Use only supplied abstracts/metadata for claims described as supported by retrieved research. You may add established background explanation, but clearly label it as background when it is not directly supported by the supplied abstracts.",
        "Cite every material evidence-based claim inline using only supplied source IDs exactly as [S1], [S2], etc. Cite only when the supplied abstract supports that claim. Never invent a citation, source, PMID, finding, guideline, date, effect size or recommendation.",
        "Write concise, well-structured Markdown: (1) Short answer, (2) Explanation / mechanism, (3) What the evidence says, (4) Important limitations or conflicting evidence, (5) Key takeaways. Adapt headings to the question and omit irrelevant sections.",
        "Distinguish randomized trials, observational studies, systematic reviews and guidelines only when the supplied metadata establishes the design/type. Do not call a PubMed abstract a guideline unless it clearly identifies itself as one.",
        "Do not claim to have read full text. The model receives abstracts and bibliographic metadata only. State when evidence is insufficient, indirect, conflicting, old or abstract-only. Do not overstate causality from observational evidence.",
        "For clinical topics, explain concepts and evidence rather than giving patient-specific diagnosis, prescriptions, dosing or treatment orders. Direct readers to current official guidelines for clinical decisions.",
        "Avoid a generic claim-evidence table. Prioritize a readable answer with citations immediately beside the claims they support."
      ].join("\n");
      try {
        const prompt = "Medical question: " + topic + "\n\nRetrieved PubMed evidence (abstracts and metadata only):\n" + sourceContext;
        const result = await generateAIText(config(), system, prompt, 2200);
        if (cancelled) return;
        setAnswer(result);
        saveAIConfig(config());
        setStatus("Answer generated from " + sources.length + " retrieved records. Review the numbered sources below.");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not generate the cited answer.");
          setStatus("");
          requestKey.current = "";
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [topic, sources, searching, apiKey, provider, model]);

  return <section className="medatlas-evidence-tutor" id="evidence-tutor">
    <div className="medatlas-evidence-tutor-head">
      <div><span className="medatlas-evidence-kicker">MEDATLAS · EVIDENCE-BASED ANSWER</span><h3>{topic}</h3><p>Automatic answer synthesis from retrieved biomedical evidence, with numbered citations you can inspect.</p></div>
      <span className="medatlas-evidence-count">{sources.length} sources</span>
    </div>
    <div className="medatlas-evidence-safety"><strong>Evidence boundary</strong> The AI receives bibliographic metadata and abstracts, not necessarily full-text papers. Citations link to original records; verify important claims in the source and current official guidance.</div>
    {searching && <div className="medatlas-evidence-status" role="status">Retrieving relevant PubMed abstracts…</div>}
    {!searching && !sources.length && <div className="medatlas-evidence-error" role="status"><strong>Evidence retrieval needs attention.</strong> {retrievalError || "No matching abstracts were returned."} Try refining the question or retrying. MedAtlas uses Europe PMC as a fallback when NCBI retrieval is unavailable.</div>}
    {sources.length > 0 && <div className="medatlas-evidence-answer">
      <div className="medatlas-evidence-answer-head"><strong>{loading ? "Generating evidence-based answer…" : answer ? "Evidence-linked answer" : "Answer generation"}</strong><span>Educational synthesis · not clinical decision support</span></div>
      {loading && <div className="medatlas-evidence-status" role="status">Reading {sources.length} retrieved abstracts and preparing a cited explanation…</div>}
      {answer && <>
        {invalidCitationIds.length > 0 && <div className="medatlas-evidence-error" role="alert"><strong>Unverified citation markers:</strong> {invalidCitationIds.join(", ")}. These references were not among the retrieved sources.</div>}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{a: ({href, children, ...props}) => <a href={href} {...props}>{children}</a>}}>{renderedAnswer}</ReactMarkdown>
        <div className="medatlas-used-sources"><h4>References · open original sources</h4><ol>{sources.map((source, index) => <li id={"medatlas-source-" + (index + 1)} key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.authors} · {source.journal} · {source.publishedAt} · PMID {source.id.replace(/^S/, "")}</small></li>)}</ol></div>
      </>}
    </div>}
    {error && <div className="medatlas-evidence-error" role="alert">{error}</div>}
    {status && <div className="medatlas-evidence-status" role="status">{status}</div>}
    <details className="medatlas-ai-settings">
      <summary>AI settings · {AI_PROVIDERS[provider].label}</summary>
      <div className="medatlas-evidence-form">
        <div className="medatlas-evidence-form-row">
          <label>AI provider<select value={provider} onChange={(e) => changeProvider(e.target.value as AIProvider)}>{(Object.keys(AI_PROVIDERS) as AIProvider[]).map((key) => <option key={key} value={key}>{AI_PROVIDERS[key].label}</option>)}</select></label>
          <label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{AI_PROVIDERS[provider].models.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <label>Provider API key<input type="password" autoComplete="off" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setStatus(""); }} placeholder="Paste your provider API key"/></label>
        <div className="medatlas-evidence-actions medatlas-ai-config-actions">
          <button type="button" className="medatlas-ai-secondary" onClick={saveSettings} disabled={!apiKey.trim()}>Save settings</button>
          <button type="button" className="medatlas-ai-secondary" onClick={testConnection} disabled={!apiKey.trim() || testing}>{testing ? "Testing…" : "Test connection"}</button>
        </div>
        <span className="medatlas-evidence-session-note">Your API key stays in this browser session. For a public production product, a secure server-side AI gateway is recommended instead of exposing user keys in browser requests.</span>
      </div>
    </details>
    <p className="medatlas-evidence-footnote">For medical education only. This synthesis is not a diagnosis or treatment recommendation. Check current official guidelines and the original publications before applying evidence.</p>
  </section>;
}
