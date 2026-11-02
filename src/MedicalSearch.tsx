import React, { useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Activity, Search, ShieldCheck, ExternalLink, BookOpen } from "lucide-react";

type EvidenceSource = {
  id: string;
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  publishedAt: string;
  abstract: string | null;
  url: string;
  sourceType: string;
  accessLevel: string;
};

type SearchResponse = {
  answerMarkdown: string;
  sources: EvidenceSource[];
  limitations: string[];
  generatedAt: string;
  disclaimer: string;
};

export default function MedicalSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);

  const sourceMap = useMemo(
    () => new Map((result?.sources || []).map((source, index) => [source.id, { source, number: index + 1 }])),
    [result?.sources]
  );

  const renderedAnswer = useMemo(() => (result?.answerMarkdown || "").replace(/\[(S\d+)\]/g, (marker, id: string) => {
    const entry = sourceMap.get(id);
    return entry ? "[" + entry.number + "](#medevidence-source-" + entry.number + ")" : "**[Unverified citation]**";
  }), [result?.answerMarkdown, sourceMap]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (!question || loading) return;
    setActiveQuery(question);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/medevidence/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, locale: "en", context: "education" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "MedEvidence could not complete this search.");
      setResult(payload as SearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence search failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="medsearch-shell">
    <header className="medsearch-header">
      <a className="medsearch-back" href="/" aria-label="Back to Clinical Companion">← Clinical Companion</a>
      <div className="medsearch-brand"><span><Activity size={21}/></span><div><strong>MedEvidence</strong><small>MEDICAL EVIDENCE DISCOVERY</small></div></div>
      <span className="medsearch-pill"><ShieldCheck size={14}/> Source-linked answers</span>
    </header>
    <main className="medsearch-main">
      <section className="medsearch-hero">
        <span className="medsearch-eyebrow">ASK · EXPLORE · VERIFY</span>
        <h1>Clinical questions,<br/><em>grounded in evidence.</em></h1>
        <p>Ask a medical question. MedEvidence retrieves biomedical literature and prepares a structured, source-linked educational summary.</p>
        <form className="medsearch-form" onSubmit={search}>
          <Search size={21}/>
          <input aria-label="Medical question" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a medical or research question…" maxLength={500}/>
          <button type="submit" disabled={!query.trim() || loading}>{loading ? "Searching…" : "Ask"}</button>
        </form>
        <div className="medsearch-suggestions"><span>Try:</span>{["Why does nephrotic syndrome cause edema?","Mechanism of diabetic ketoacidosis","Evidence on tranexamic acid in postpartum hemorrhage"].map((term) => <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>)}</div>
      </section>
      <div className="medsearch-disclaimer"><ShieldCheck size={17}/><p><strong>Educational evidence discovery only.</strong> This tool does not provide patient-specific diagnosis or treatment orders. Check current official guidance and original publications before applying evidence.</p></div>
      {error && <div className="medsearch-error" role="alert">{error}</div>}
      {loading && <div className="medsearch-loading"><span className="medsearch-spinner"/><p>Retrieving biomedical abstracts and preparing a cited synthesis…</p></div>}
      {activeQuery && !loading && result && <section className="medatlas-evidence-tutor" id="evidence-tutor">
        <div className="medatlas-evidence-tutor-head">
          <div><span className="medatlas-evidence-kicker">MEDEVIDENCE · EVIDENCE SUMMARY</span><h3>{activeQuery}</h3><p>Generated {new Date(result.generatedAt).toLocaleString()}</p></div>
          <span className="medatlas-evidence-count">{result.sources.length} sources</span>
        </div>
        <div className="medatlas-evidence-safety"><strong>Evidence boundary</strong> The current synthesis uses retrieved abstracts and bibliographic metadata. It does not imply full-text appraisal or formal evidence grading.</div>
        <div className="medatlas-evidence-answer">
          <div className="medatlas-evidence-answer-head"><strong>Evidence-linked answer</strong><span>Educational synthesis · not clinical decision support</span></div>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderedAnswer}</ReactMarkdown>
          {result.sources.length > 0 && <div className="medatlas-used-sources">
            <h4>References · open original records</h4>
            <ol>{result.sources.map((source, index) => <li id={"medevidence-source-" + (index + 1)} key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={13}/></a>
              <small>{source.authors} · {source.journal} · {source.publishedAt} · PMID {source.pmid} · Abstract-based</small>
            </li>)}</ol>
          </div>}
        </div>
        {result.limitations?.length > 0 && <div className="medatlas-evidence-safety"><strong>Limitations</strong><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        <p className="medatlas-evidence-footnote">{result.disclaimer} Verify important claims in the original sources and current official guidelines.</p>
      </section>}
      {!activeQuery && <section className="medsearch-start-grid"><article><Search/><h3>One question</h3><p>Ask a focused clinical or biomedical research question.</p></article><article><BookOpen/><h3>Evidence synthesis</h3><p>Receive a structured answer grounded in retrieved literature.</p></article><article><ShieldCheck/><h3>Transparent sources</h3><p>Inspect numbered references and the evidence limitations.</p></article></section>}
      <footer className="medsearch-footer">MedEvidence · Evidence discovery for medical education and professional learning · Not a diagnostic or treatment tool</footer>
    </main>
  </div>;
}
