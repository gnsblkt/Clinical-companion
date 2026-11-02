# MedAtlas evidence-first learning architecture

## Current feature modules

- `src/features/medatlas/api/evidenceSearch.ts`: PubMed E-utilities retrieval, including abstracts and bibliographic metadata, plus official guideline discovery portals.
- `src/features/medatlas/components/EvidenceTutor.tsx`: user-key-only AI synthesis interface for Groq, OpenAI, OpenRouter and Gemini.
- `src/features/medatlas/data/pathways.ts`: versioned pathway data, review metadata and learning checkpoint types.
- `src/features/medatlas/components/VersionedPathway.tsx`: renders a pathway and converts its active-recall prompts into flashcards.
- `src/MedicalSearch.tsx`: existing MedAtlas search and pathway workspace, now connects retrieved evidence and pathway modules.

## Evidence workflow

1. Search PubMed live using NCBI E-utilities.
2. Retrieve bibliographic details and abstracts for a bounded set of records.
3. Present the evidence context to the AI provider selected by the user.
4. Ask the provider to use source IDs `[S1]`, `[S2]`, etc. and avoid unsupported citations.
5. Convert source IDs into links to the corresponding PubMed records.
6. Show the source list, abstract/full-text boundary and expandable “How this answer was built” explanation.

## Important trust limitations

- Model-generated citations are not independently entailment-validated. They are links to records retrieved for this search, not proof that a source supports the associated claim.
- The model receives PubMed metadata and abstracts, not publisher full text.
- Guideline portals are discovery links. MedAtlas does not currently retrieve or parse complete guideline documents.
- The starter pathways are educational scaffolds and intentionally marked `needs-review`. They are not clinical algorithms.
- A pathway review date means the data entry's last review metadata, not automatic evidence surveillance.
- Provider calls are direct from the browser using the user's own API key. Keys remain in React component state, are not persisted to localStorage by this feature, and may be visible to the selected provider. API use may incur costs.
- Avoid entering patient-identifiable information or confidential clinical data.

## Future hardening

- Citation entailment checks and unsupported-claim highlighting.
- Guideline document retrieval with version/update detection and jurisdiction metadata.
- Pathway review workflow, source changelog, contributors and automated stale-source warnings.
- Cross-provider adapter abstraction, retry/backoff, PubMed API rate-limit etiquette and offline evidence cache.
- Automated unit tests for PubMed parsing, citation link resolution and pathway schema.
- Clinical editorial review before pathways are marked reviewed.
