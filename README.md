# Clinical Companion AI— Open-source PWA

A responsive medical study workspace for clinical learning and postgraduate entrance exam revision. The project is MIT-licensed and its complete source is editable. It is an educational prototype, not a validated clinical decision-support system.

## Features

- Responsive mobile, tablet and desktop UI; installable PWA with app-shell offline caching.
- AI study chat with optional user-owned OpenAI, Google Gemini, OpenRouter and Groq API keys.
- OpenRouter/Groq provider auto-detection from common key prefixes and model-list discovery from provider APIs.
- CSV MCQ import and practice, flashcard creation, local notes, PDF/TXT/Markdown document text extraction.
- Sample CSV download, light/dark theme and local browser storage for notes and MCQs.
- GitHub Actions build workflow, Vercel configuration and MIT license.

## Edit the app

- Main application and feature logic: `src/App.tsx`
- Styling and responsive UI: `src/index.css`
- App entry point: `src/main.tsx`
- PWA metadata: `public/manifest.webmanifest`
- Offline shell caching: `public/sw.js`
- Vercel build configuration: `vercel.json`

Edit these files directly in GitHub's web editor or clone the repository and edit locally. Commit/push changes to the connected branch to trigger the GitHub build workflow and, once Vercel is connected, automatic Vercel deployments.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Publish with GitHub + Vercel

1. Create a **public** GitHub repository named `med-atlas-mate` under your account.
2. Upload the contents of this folder to the repository root (not the containing folder). Include hidden files such as `.github/workflows/ci.yml` and `.gitignore`.
3. In Vercel, choose **Add New → Project**, import that GitHub repository and authorize access if prompted.
4. Confirm the framework is **Vite**, build command is `npm run build`, and output directory is `dist`; deploy.
5. Future commits to the production branch will trigger a new deployment automatically when the Vercel Git connection is enabled.

Vercel and GitHub accounts must be authorized by the owner. This source bundle cannot grant access to accounts or create a repository on their behalf.

## AI provider and API-key safety

Keys are entered by the individual user and held in React component memory; they are not intentionally written to localStorage and clear on refresh. AI requests currently go directly from the browser to the provider. This is suitable only for a personal prototype using your own restricted key, not for embedding a shared key in a public app. Do not hard-code secrets in source code. For a shared public AI service, add a server-side proxy with rate limits, abuse controls and server-side secret storage. AI usage may incur charges; this project does not provide API credits.

## Offline and local data

The service worker caches the app shell and same-origin build assets as they are visited. The first visit requires internet; AI calls also require internet. Notes and MCQs stay in the current browser profile and do not sync between devices. Browser storage can be cleared by the user or browser.

## Clinical and document limitations

- AI responses are not independently fact-checked and do not have guaranteed live citations. Verify clinical information against current, authoritative references and local protocols.
- Do not use the app as a substitute for professional judgement, senior review or emergency care. Do not upload patient-identifiable information.
- PDF extraction is text extraction, not OCR; scanned pages and complex layouts may not be captured correctly.

## CSV format

```csv
Question,Option1,Option2,Option3,Option4,Answer,Explanation
"Which cells produce surfactant?","Type I pneumocytes","Type II pneumocytes","Macrophages","Club cells",B,"Type II pneumocytes produce pulmonary surfactant."
```

`Answer` accepts A/B/C/D or a zero-based numeric option index. Quote cells containing commas or line breaks.

## Contributing and license

Issues and pull requests are welcome. Never submit patient-identifiable information, API keys, secrets or content you do not have permission to redistribute. Licensed under MIT; see `LICENSE`.
