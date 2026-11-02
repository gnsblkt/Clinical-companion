# MedAtlas: Evidence-first medical intelligence platform

## Product thesis

MedAtlas should be an evidence-first medical learning and clinical knowledge workspace, not a general chatbot with a search panel. The primary interaction is a medical question. The system retrieves relevant evidence, synthesises a qualified answer, attaches traceable citations to material claims, exposes recommendations and uncertainty, and then lets the learner inspect the underlying literature.

The UI hierarchy is:

1. **Ask MedAtlas (primary):** question composer, context controls, answer, inline citations, and follow-up questions.
2. **Recommendation and evidence brief:** guideline-derived recommendations separated from research findings; issuing body, jurisdiction, population, version/date, strength/certainty, and source links.
3. **Evidence explorer:** guideline documents, systematic reviews/meta-analyses, RCTs, observational studies, diagnostic-accuracy studies, and relevant PubMed records with abstracts and full-text links where available.
4. **Learning layer:** explain concepts, compare differentials, mechanism maps, exam pearls, flashcards, and case-based follow-up prompts.
5. **Transparency layer:** search strategy, databases queried, date searched, inclusion logic, source limitations, conflict/uncertainty, and audit trail.

## Interaction model

### Primary answer card

Every response should use a predictable structure, adapted to the question:

- Direct answer / clinical question framing
- Recommendation summary (only when a traceable current guideline recommendation is retrieved)
- Rationale and mechanism
- Evidence supporting the answer
- Important alternatives / exceptions
- What is uncertain or conflicting
- Practical learning points
- References with claim-level citations

For a clinical management question, add population, setting, contraindications, escalation/red flags, and local applicability. For an exam question, add why the keyed option is correct, why distractors are incorrect, and a memory aid. For a basic-science question, prioritise mechanisms and foundational references.

### Recommendation integrity

Never infer a guideline recommendation from an abstract, title, search snippet, or a model's prior knowledge. A recommendation object must retain:
- issuing organisation and guideline title
- publication date, update/version and jurisdiction
- target population and clinical setting
- verbatim/faithful recommendation text and recommendation identifier/page/section
- strength of recommendation and certainty/quality of evidence when explicitly reported
- source URL and retrieval timestamp
- any adaptation/localisation warning

If this data is unavailable, say **"No directly retrieved guideline recommendation is available for this question"** and provide a research-based synthesis separately. Do not fabricate grades, evidence certainty, or consensus.

## Retrieval and evidence architecture

### Source tiers

1. Official guideline repositories and organisations: WHO, NICE, CDC, specialty societies (e.g. GINA, GOLD, KDIGO, ESC, AHA/ACC, IDSA, FIGO, ACOG), and Nepal MoHP/DoHS where accessible.
2. Evidence synthesis: Cochrane, systematic reviews and meta-analyses.
3. Primary biomedical literature: PubMed/MEDLINE and Europe PMC; add trial registries and regulatory safety communications where relevant.
4. Educational/tertiary sources: only for orientation and learning support, never silently treated as primary evidence.

### Retrieval pipeline

1. Classify the question: clinical management, diagnosis, therapeutics, prognosis, mechanism, exam, public health, or other.
2. Build a transparent search strategy (PICO/PECO where useful), synonyms, date range, population and study-type filters.
3. Retrieve from multiple source adapters in parallel, with timeout, retry, caching, provenance and source-specific error handling.
4. Parse metadata and full text only where access and licensing permit. Respect publisher and repository terms; do not bypass paywalls.
5. Deduplicate by DOI, PMID, PMCID and canonical URL.
6. Rank by source authority, recency, study design, directness, population match and methodological quality—not citation count alone.
7. Extract evidence statements and recommendation objects with exact source spans/pages/sections.
8. Generate an answer only from retrieved context plus explicitly labelled general background knowledge.
9. Validate every citation ID against retrieved records; require a supporting text span for material claims.
10. Return the answer with limitations, search date and source links.

### Evidence appraisal

Use question-appropriate appraisal:
- Therapy/prevention: RCTs, systematic reviews, absolute effects, relative effects, NNT/NNH when computable, and certainty.
- Diagnosis: sensitivity/specificity, likelihood ratios, reference standard, spectrum and setting.
- Prognosis: cohort design, calibration, discrimination and external validity.
- Harm: observational evidence, exposure definition, confounding and signal strength.
- Guidelines: issuing process, evidence grading, conflicts of interest, currency, population and jurisdiction.

Do not claim to have performed GRADE, RoB 2, ROBINS-I, QUADAS-2 or AMSTAR 2 unless the required source data and a reproducible appraisal workflow actually ran. AI-assisted appraisal must be labelled as such and remain inspectable.

## UX recommendations

- Keep the AI tutor immediately below the search header and above all source lists.
- Keep the question composer visible at the top of the answer card; after an answer, show a compact follow-up composer.
- Add answer tabs/anchors: **Answer · Recommendations · Evidence · Learning**.
- Put source count, search date, and source types beside the answer; allow users to expand the search strategy.
- Inline citation chips open a side panel (desktop) or bottom sheet (mobile) showing the exact source, abstract/full text availability, supporting excerpt, publication date and limitations.
- Use distinct, non-confusing labels: "Official guideline", "Systematic review", "Randomised trial", "Observational study", "Other PubMed record". A PubMed guideline publication-type record is not automatically a current guideline.
- Mobile: one-column cards, sticky but keyboard-safe composer, bottom-sheet citations, no horizontal page overflow, large touch targets, and collapsible evidence sections.
- Add answer actions: copy, save to notes, create flashcards, explain simpler/deeper, compare guidelines, and ask follow-up.
- Add modes: **Learn** (student/exam), **Clinical evidence** (clinician), and **Research** (PICO/search strategy). Modes change answer framing, never lower evidence standards.
- Show a persistent educational / clinical-use boundary. Avoid patient-specific orders or false assurance.

## Data model (target)

- `SearchSession`: query, question type, PICO, filters, databases, searchedAt, search strategy, errors.
- `SourceRecord`: sourceId, sourceType, title, authors, organisation, date, version, jurisdiction, DOI/PMID/PMCID, canonical URL, abstract/full-text status, retrievedAt.
- `EvidenceExcerpt`: sourceId, exact text, page/section/paragraph, locator, extraction method.
- `Recommendation`: sourceId, organisation, recommendationText, population, setting, strength, certainty, version, section/page, jurisdiction, status.
- `EvidenceClaim`: claim text, source IDs, supporting excerpt IDs, relation (supports/contradicts/qualifies), confidence, reviewer status.
- `Answer`: structured sections, claim links, limitations, generatedAt, model/provider, prompt/version, validation status.
- `UserLearningArtifact`: saved answer, notes, flashcards, bookmarks, spaced-repetition state.

## Reliability, privacy and security

- Move provider calls and credentials behind a server-side API/proxy before commercial public release. Never expose platform-owned API keys in browser bundles. If users bring their own key, explain that it is sent to the provider and keep it out of analytics/logs.
- Add rate limits, request budgets, provider failover, timeouts, retry/backoff, caching and abuse controls.
- Use structured outputs and schema validation; reject malformed answer/evidence payloads.
- Treat retrieved pages and abstracts as untrusted data, not instructions.
- Keep source provenance and answer versions so an answer can be reproduced and audited.
- Avoid storing patient-identifiable information by default. Add explicit privacy controls and retention policy before accepting clinical case data.
- Include content review workflow, corrections/reporting, and source-update monitoring.
- Do not market as a diagnostic device or clinical decision support product without the necessary regulatory and clinical validation.

## Delivery roadmap

### Phase 1 — trustworthy question-to-answer experience
- Primary tutor-first layout (implemented in this branch).
- Shared AI settings and provider adapter.
- PubMed abstract retrieval, citation ID validation, honest abstract-only limitations.
- Better error states and mobile layout.
- Add deterministic tests for search-state assignment, provider request formatting, citation mapping and empty-source handling.

### Phase 2 — actual guideline retrieval
- Create source adapters for official guideline portals and accessible guideline repositories.
- Store guideline version, date, recommendation section/page, population, jurisdiction and grading.
- Parse and index permitted HTML/PDF documents; cite exact sections/pages.
- Keep guideline recommendations separate from research-derived synthesis.
- Add stale/conflicting guideline warnings and local applicability metadata.

### Phase 3 — evidence synthesis engine
- PICO extraction and multi-database search.
- Systematic-review/trial prioritisation and deduplication.
- Claim-level evidence spans, contradiction detection and transparent evidence tables.
- Human-reviewed appraisal templates and reproducible search histories.

### Phase 4 — powerful learning workspace
- Exam mode, clinical reasoning mode and research mode.
- Case-based learning, differential diagnosis comparisons, mechanism maps and spaced repetition.
- Save/share/export answers and evidence briefs.
- User feedback and expert review pipeline.

### Phase 5 — production trust and scale
- Secure server-side provider gateway, auth, quotas and audit logs.
- Automated regression/evaluation suite with curated clinical questions.
- Expert clinical content review, monitoring, incident response and source surveillance.
- Performance, accessibility, mobile/offline resilience and multilingual support.

## Acceptance criteria for a trustworthy answer

A response is not considered evidence-grounded unless:
1. The search sources and search date are disclosed.
2. Every material cited claim links to a retrieved source.
3. Citation IDs resolve to the exact source supplied to the model.
4. Guideline recommendations are backed by an accessible guideline source and exact section/version; otherwise the UI explicitly says no recommendation was retrieved.
5. Evidence type, recency, population and limitations are visible.
6. Contradictory or insufficient evidence is reported rather than smoothed over.
7. The answer can be reproduced from its recorded search and source set.
8. Clinical safety and expert review boundaries are clear.
