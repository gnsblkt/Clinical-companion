export type PathwayStep = {
  id: string;
  title: string;
  learningObjective: string;
  checkpoints: string[];
  recallPrompt: string;
};

export type LearningPathway = {
  id: string;
  title: string;
  specialty: string;
  version: string;
  lastReviewed: string;
  reviewStatus: "reviewed" | "needs-review";
  disclaimer: string;
  sources: Array<{ label: string; url: string }>;
  steps: PathwayStep[];
};

/**
 * Educational pathway metadata. These are learning maps, not treatment algorithms.
 * Content owners should update review dates and references whenever evidence changes.
 */
export const medAtlasPathways: LearningPathway[] = [
  {
    id: "dka-core",
    title: "Diabetic ketoacidosis (DKA)",
    specialty: "Endocrinology / Emergency medicine",
    version: "1.0.0",
    lastReviewed: "2026-11-02",
    reviewStatus: "needs-review",
    disclaimer: "DKA is a medical emergency. This pathway is an educational framework only—not a diagnostic, dosing, or treatment protocol. Refer to current local adult/paediatric guidance and senior supervision.",
    sources: [
      { label: "PubMed · DKA literature", url: "https://pubmed.ncbi.nlm.nih.gov/?term=diabetic+ketoacidosis" },
      { label: "ADA Standards of Care", url: "https://diabetesjournals.org/care/issue" },
      { label: "WHO publications", url: "https://www.who.int/publications/i" },
    ],
    steps: [
      { id: "recognition", title: "Recognise the syndrome", learningObjective: "Connect hyperglycaemia, ketonaemia and metabolic acidosis; remember euglycaemic presentations.", checkpoints: ["Clinical context and precipitating factors", "Glucose, ketones and acid–base status", "Important mimics and mixed disorders"], recallPrompt: "Which three biochemical domains define DKA?" },
      { id: "severity", title: "Understand severity assessment", learningObjective: "Learn how acid–base status, ketones, mental state and physiology inform severity.", checkpoints: ["Compare adult and paediatric criteria", "Identify altered mental status and shock as concerning features", "Review limitations of isolated glucose values"], recallPrompt: "Why can glucose alone not grade DKA severity?" },
      { id: "mechanism", title: "Explain the physiology", learningObjective: "Relate insulin deficiency and counter-regulatory hormones to lipolysis, ketogenesis and dehydration.", checkpoints: ["Insulin deficiency and glucagon excess", "Ketone production and acidosis", "Osmotic diuresis and electrolyte shifts"], recallPrompt: "How does insulin deficiency promote ketogenesis?" },
      { id: "management-principles", title: "Study treatment principles", learningObjective: "Review fluid, insulin, electrolyte and precipitant management as separate protocol-dependent domains.", checkpoints: ["Use a current local protocol", "Understand potassium and insulin safety concepts", "Review monitoring, resolution criteria and complications"], recallPrompt: "Why must electrolyte status be considered before insulin therapy?" },
    ],
  },
  {
    id: "sepsis-core",
    title: "Sepsis: recognition and evidence appraisal",
    specialty: "Emergency medicine / Infectious diseases",
    version: "1.0.0",
    lastReviewed: "2026-11-02",
    reviewStatus: "needs-review",
    disclaimer: "Sepsis is time-critical. This is a learning framework, not bedside triage or a resuscitation protocol. Follow current local escalation and antimicrobial guidance.",
    sources: [
      { label: "Surviving Sepsis Campaign", url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines" },
      { label: "WHO · sepsis", url: "https://www.who.int/health-topics/sepsis" },
      { label: "PubMed · sepsis literature", url: "https://pubmed.ncbi.nlm.nih.gov/?term=sepsis+guidelines" },
    ],
    steps: [
      { id: "definitions", title: "Definitions and recognition", learningObjective: "Distinguish infection, sepsis and septic shock using current consensus definitions.", checkpoints: ["Organ dysfunction context", "Limitations of screening scores", "Differential diagnoses"], recallPrompt: "How does sepsis differ from uncomplicated infection?" },
      { id: "source", title: "Investigate source and physiology", learningObjective: "Connect source assessment, organ dysfunction and microbiological evidence.", checkpoints: ["Likely source and mimics", "Cultures and investigations", "Perfusion and organ dysfunction trends"], recallPrompt: "Why should a screening score not be used alone?" },
      { id: "evidence", title: "Appraise treatment evidence", learningObjective: "Understand antimicrobial timing, source control, haemodynamic support and reassessment as evidence-sensitive domains.", checkpoints: ["Current SSC and local guidance", "Antimicrobial stewardship", "Repeated assessment and source control"], recallPrompt: "Why are source control and reassessment central concepts?" },
    ],
  },
];

export function getPathwayForTopic(query: string): LearningPathway | undefined {
  const q = query.toLowerCase();
  if (/\b(dka|diabetic ketoacidosis)\b/.test(q)) return medAtlasPathways.find((p) => p.id === "dka-core");
  if (/\b(sepsis|septic shock)\b/.test(q)) return medAtlasPathways.find((p) => p.id === "sepsis-core");
  return undefined;
}
