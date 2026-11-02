import React, { useState, type FormEvent } from "react";
import EvidenceTutor from "./features/medatlas/components/EvidenceTutor";
import { searchPubMedEvidence, type EvidenceSource } from "./features/medatlas/api/evidenceSearch";
import { Activity, Search, ShieldCheck } from "lucide-react";

export default function MedicalSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrievalError, setRetrievalError] = useState("");
  const [sources, setSources] = useState<EvidenceSource[]>([]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term || loading) return;
    setLoading(true);
    setError("");
    setRetrievalError("");
    setSources([]);
    setActiveQuery(term);
    try {
      const results = await searchPubMedEvidence(term, 8);
      setSources(results);
      if (!results.length) setRetrievalError("No abstracts were returned for this query. Try a more specific or broader search.");
    } catch (err) {
      setRetrievalError(err instanceof Error ? err.message : "PubMed and Europe PMC could not retrieve evidence. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="medsearch-shell">
    <header className="medsearch-header">
      <a className="medsearch-back" href="/" aria-label="Back to Clinical Companion">← Clinical Companion</a>
      <div className="medsearch-brand"><span><Activity size={21}/></span><div><strong>MedAtlas</strong><small>EVIDENCE-BASED MEDICAL ANSWERS</small></div></div>
      <span className="medsearch-pill"><ShieldCheck size={14}/> Source-linked answers</span>
    </header>
    <main className="medsearch-main">
      <section className="medsearch-hero">
        <span className="medsearch-eyebrow">ASK · UNDERSTAND · VERIFY</span>
        <h1>Medical answers,<br/><em>grounded in evidence.</em></h1>
        <p>Search a medical question. MedAtlas retrieves biomedical abstracts and automatically synthesizes a cited educational answer.</p>
        <form className="medsearch-form" onSubmit={search}>
          <Search size={21}/>
          <input aria-label="Medical question" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a medical question…" maxLength={500}/>
          <button type="submit" disabled={!query.trim() || loading}>{loading ? "Retrieving…" : "Ask"}</button>
        </form>
        <div className="medsearch-suggestions"><span>Try:</span>{["Why does nephrotic syndrome cause edema?","Mechanism of diabetic ketoacidosis","Evidence for tranexamic acid in postpartum hemorrhage"].map((term) => <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>)}</div>
      </section>
      <div className="medsearch-disclaimer"><ShieldCheck size={17}/><p><strong>Educational use only.</strong> AI-generated explanations are not clinical recommendations. Check current official guidelines and original sources; abstracts are not a substitute for full-text appraisal.</p></div>
      {error && <div className="medsearch-error" role="alert">{error}</div>}
      {loading && <div className="medsearch-loading"><span className="medsearch-spinner"/><p>Retrieving PubMed abstracts and checking Europe PMC fallback…</p></div>}
      {activeQuery && <EvidenceTutor key={activeQuery} topic={activeQuery} sources={sources} searching={loading} retrievalError={retrievalError}/>}
      {!activeQuery && <section className="medsearch-start-grid"><article><Search/><h3>One search</h3><p>Ask a focused medical question in natural language.</p></article><article><Activity/><h3>Automatic synthesis</h3><p>Get a structured explanation with inline numbered citations.</p></article><article><ShieldCheck/><h3>Transparent evidence</h3><p>Open each cited source and inspect its abstract, methods and limitations.</p></article></section>}
      <footer className="medsearch-footer">MedAtlas · Evidence discovery for medical education · Not a diagnostic or treatment tool</footer>
    </main>
  </div>;
}
