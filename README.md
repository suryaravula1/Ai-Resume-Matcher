# AI Resume Matcher

A privacy-first static web app that compares uploaded resume PDFs against a pasted job description and returns an ATS-style match score.

## Why This Version Is Safe For GitHub Pages

This app runs fully in the browser:

- No backend server
- No database
- No Python runtime
- No resume files uploaded to GitHub
- No resumes stored after the browser session ends

Users select PDF resumes from their computer, paste a job description, and the matching logic runs locally on their device.

## Features

- Parse multiple PDF resumes in the browser with `pdfjs-dist`
- Score resumes against a pasted job description
- Show best match percentage
- Show matched keywords and missing keywords
- Show category-level ATS-style scoring
- Deploy as a static site to GitHub Pages

## Tech Stack

- Next.js App Router
- React
- TypeScript
- PDF.js via `pdfjs-dist`
- GitHub Pages static export

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build Static Site

```bash
npm run build:pages
```

The static export is generated in:

```text
out/
```

## Deploy To GitHub Pages

The repo includes a GitHub Actions workflow:

```text
.github/workflows/pages.yml
```

After pushing to `main`, enable GitHub Pages:

1. Open the repository on GitHub.
2. Go to `Settings` → `Pages`.
3. Under `Build and deployment`, choose `GitHub Actions`.
4. Re-run the `Deploy GitHub Pages` workflow if needed.

The app will deploy under:

```text
https://suryaravula1.github.io/Ai-Resume-Matcher/
```

## Important Note

The score is an ATS-style estimate, not a guarantee from any specific ATS vendor. The current version uses transparent keyword, phrase, category, and lexical overlap scoring. A future version can add semantic embeddings or AI-based JD parsing.

## Privacy Guardrails

The repository ignores private documents, resume data, generated databases, and build artifacts. Keep real resumes outside the repository.
