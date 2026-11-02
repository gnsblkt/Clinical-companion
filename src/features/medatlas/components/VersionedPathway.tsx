import React from "react";
import type { LearningPathway } from "../data/pathways";

export default function VersionedPathway({ pathway, onGenerateCards }: { pathway: LearningPathway; onGenerateCards: (cards: Array<{ question: string; answer: string }>) => void }) {
  return <section className="medatlas-versioned-pathway">
    <header><div><span className="medatlas-evidence-kicker">STRUCTURED LEARNING PATHWAY</span><h3>{pathway.title}</h3><p>{pathway.specialty} · Version {pathway.version}</p></div><span className={pathway.reviewStatus === "reviewed" ? "medatlas-review-badge reviewed" : "medatlas-review-badge"}>{pathway.reviewStatus === "reviewed" ? "Reviewed" : "Needs clinical review"}</span></header>
    <div className="medatlas-pathway-meta"><span>Last reviewed: {pathway.lastReviewed}</span><span>Educational framework · Not a care algorithm</span></div>
    <div className="medatlas-evidence-safety">{pathway.disclaimer}</div>
    <div className="medatlas-pathway-steps">{pathway.steps.map((step, index) => <article key={step.id}><span className="medatlas-pathway-step-number">{String(index + 1).padStart(2, "0")}</span><div><h4>{step.title}</h4><p>{step.learningObjective}</p><ul>{step.checkpoints.map((checkpoint) => <li key={checkpoint}>{checkpoint}</li>)}</ul><details><summary>Active recall</summary><p>{step.recallPrompt}</p></details></div></article>)}</div>
    <div className="medatlas-used-sources"><h4>Pathway reference portals</h4>{pathway.sources.map((source) => <article key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></article>)}</div>
    <button type="button" className="medatlas-pathway-action" onClick={() => onGenerateCards(pathway.steps.map((step) => ({ question: step.recallPrompt, answer: step.learningObjective + " Key checkpoints: " + step.checkpoints.join("; ") })))}>Create pathway flashcards</button>
  </section>;
}
