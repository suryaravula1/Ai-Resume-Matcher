# Resume Matcher Next

A local Next.js application for ranking resume PDFs against a pasted job description.

## What it does

- Scans a resume folder once and stores extracted PDF text in SQLite.
- Skips unchanged PDFs on future index runs using file size and modified time.
- Marks removed PDFs inactive instead of deleting historical rows.
- Scores all indexed resumes against a pasted JD without re-reading PDFs.
- Shows the best resume, estimated ATS-style percentage, matched keywords, missing keywords, and category scores.

## Stack

- Frontend: Next.js App Router
- API: Next.js route handlers
- Engine: Python script called from the API
- PDF parsing: `pypdf`
- Database: SQLite with an optional FTS5 table

## Run locally

```bash
cd resume-matcher-next
npm install
python3 -m pip install -r requirements.txt
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set your private resume folder with an environment variable or paste it into the UI:

```bash
RESUME_MATCHER_FOLDER="/path/to/resumes" npm run dev
```

If you prefer a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm run dev
```

## Workflow

1. Click `Index / refresh PDFs`.
2. Paste a job description.
3. Keep the target ATS score at `94` or adjust it.
4. Click `Find best resume`.
5. If the best score meets the target, use that file. If not, tailor a new resume from the closest match.

## How scoring works

The score is an estimate, not a guarantee from any specific ATS vendor. It combines:

- Core software engineering overlap
- Languages and frameworks
- Azure/cloud and DevOps
- Domain terms like actuarial, insurance, risk, modeling, pricing, and reporting
- Agile, unit testing, TDD/BDD
- Requirements, delivery, communication, and customer focus
- Education fit
- Dynamic keyword overlap from the pasted JD

## Engine commands

Index a folder:

```bash
python3 scripts/resume_engine.py --db .data/resume_matcher.sqlite3 index --folder /path/to/resumes
```

Read status:

```bash
python3 scripts/resume_engine.py --db .data/resume_matcher.sqlite3 status
```

## Privacy

The repository intentionally ignores generated databases, PDFs, Word documents, spreadsheets, text exports, and local resume folders. Keep resume data outside the repo and point the app to that folder at runtime.
