# MedAtlas — Medical Learning PWA

MedAtlas is a Vite + React + TypeScript progressive web app for clinical learning and postgraduate entrance exam revision, including NEET-PG, INI-CET, MECEE-PG and USMLE-oriented study. The project is MIT-licensed.

> **Educational use only.** MedAtlas is an educational prototype, not a validated clinical decision-support system. Do not use it as a substitute for professional judgement, local protocols or current authoritative clinical guidance.

## Current features

- MCQ banks with CSV import, practice, editing, image support and AI tutor explanations.
- Flashcards, local notes and PDF/TXT/Markdown text extraction.
- AI study chat with optional user-supplied provider keys for OpenAI, Gemini, OpenRouter and Groq.
- Medical discovery using PubMed via NCBI E-utilities, Wikipedia and Wikimedia Commons.
- Guideline discovery links for WHO, NICE, CDC, India MoHFW and Nepal DoHS.
- Dark/light theme, responsive layout and installable PWA with app-shell caching.
- Cloudinary image integration and Capacitor configuration.

Feature availability depends on network access, provider availability, user configuration and API limits.

## Medical information and source limitations

The medical search feature is a discovery tool. Search snippets, article metadata and guideline portal links are not equivalent to a critical appraisal or a verified clinical recommendation. Always open and assess the original source, publication date, population, methods and limitations. Some search workflows may return metadata without an abstract. Do not infer missing evidence.

AI-generated explanations can be incomplete or incorrect. Verify important medical facts, drug doses and emergency recommendations against current authoritative sources and local protocols.

## Privacy, API keys and browser storage

- Study content is stored locally in the browser using browser storage; it is not automatically synchronized across devices.
- Browser-local data is not an encrypted backup. Clearing site data or changing devices may cause loss.
- The Groq key entered for the AI Tutor is held in React component memory and cleared on page reload. Older copies of the key in localStorage are removed when the app starts.
- AI requests are sent directly from the browser to the selected provider. A key used in a browser request can be inspected by the browser user and should never be a shared, privileged or organization-wide secret.
- A server-side proxy with authentication, rate limiting and secret storage is recommended before offering shared-key AI access to a public multi-user audience.
- Configure Cloudinary with a narrowly restricted upload preset and appropriate file type, size and quota limits. Never ship an API secret in frontend code.

## Requirements

- Node.js 20 or newer.
- npm.

## Local development

```bash
npm install
npm run dev
```

Available validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```

Preview a production build with `npm run preview`.

## Continuous integration

GitHub Actions runs TypeScript checking, ESLint and a production Vite build for pushes to `main` and pull requests targeting `main`.

This repository currently has no committed npm lockfile. CI therefore uses `npm install`; reproducible, lockfile-based installs should be enabled after generating and committing `package-lock.json`.

## Deploy with GitHub and Vercel

1. Import this repository into Vercel.
2. Select Vite (or use the detected framework settings).
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Deploy a preview first, then promote a verified release to production.

The Vercel configuration supports SPA route fallback. External medical search and AI services still require network access.

## Capacitor

The Capacitor configuration uses the local `dist` build and does not point the native app at a hosted preview URL. Before publishing a native app, confirm the permanent bundle identifier, app signing, privacy disclosures, permissions and store requirements.

## License

MIT. See [LICENSE](./LICENSE).
