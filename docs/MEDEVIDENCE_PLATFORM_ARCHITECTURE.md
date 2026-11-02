# MedEvidence shared platform architecture

## Product identity
MedEvidence is the shared evidence engine and clinician-facing product. MedQuest is the medical education and exam-preparation product. Both clients consume one shared API; neither should duplicate evidence retrieval or answer synthesis.

## Current source baseline
- Repository: `gnsblkt/Clinical-companion`
- Baseline branch: `fix/medatlas-ai-evidence-mobile`
- Working branch: `feat/medevidence-shared-platform`
- Existing standalone Vercel project: `clinical-companion-jidf`
- The original `clinical-companion` project remains untouched.

## Shared API
Initial endpoint: `POST /api/medevidence/search`

Request:
```json
{ "question": "string", "locale": "en", "context": "education" }
```

Response:
```json
{
  "answerMarkdown": "string",
  "sources": [{
    "id": "S1",
    "title": "string",
    "authors": "string",
    "journal": "string",
    "publishedAt": "string",
    "sourceType": "pubmed|guideline|systematic-review|other",
    "abstract": "string|null",
    "url": "https://...",
    "pmid": "string|null",
    "accessLevel": "abstract|full-text|metadata"
  }],
  "limitations": ["string"],
  "generatedAt": "ISO-8601",
  "disclaimer": "Educational use only; not a substitute for professional judgement."
}
```

## Security model
- AI provider credentials exist only in server-side environment variables.
- Never accept arbitrary provider URLs or model endpoints from the browser.
- Validate and cap question length and request size.
- Anonymous traffic receives IP/session-aware rate limits and abuse controls.
- Do not log raw queries or source content unless necessary for debugging, with documented retention.
- MedQuest identity is optional. Validate Appwrite credentials server-side; never trust a client-supplied account ID.
- Saved searches are an optional persistence layer, not a prerequisite for guest search.
- Do not add another Appwrite Function: the connected MedQuest Appwrite project already has two functions and is at its current plan limit.

## Clinical quality gates
- Retrieval provenance: PubMed/Europe PMC identifiers and official guideline URLs.
- De-duplicate records and report retrieval dates.
- Separate guideline recommendations from AI synthesis of research abstracts.
- Label abstract-only evidence accurately.
- Every citation marker must resolve to a returned source.
- A citation's existence is not proof of claim support; implement claim-level support checks before claiming citations are validated.
- Surface uncertainty, contradictory findings, study design and applicability limits.
- No invented GRADE, risk-of-bias or evidence certainty assessments.
- Educational product; not a patient-specific diagnostic or prescribing service.

## Client responsibilities
### Standalone MedEvidence
Guest-first search, clear evidence answer, references, optional account for saved searches and reports.

### MedQuest
Authenticated navigation entry point, same answer experience, optional association of searches with the learner's study context. Do not alter existing MCQ, import, bookmark or SRS records.

## Deployment isolation
- Keep changes on `feat/medevidence-shared-platform`.
- Use Vercel preview deployments for verification.
- Do not promote to production, change custom domains, or modify the original `clinical-companion` project during development.
- MedQuest integration is developed separately in `gnsblkt/Medquest-` branch `feat/medevidence-integration`.
