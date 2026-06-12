"use client";

import { useMemo, useRef, useState } from "react";

type ResumeDocument = {
  id: string;
  fileName: string;
  size: number;
  pageCount: number;
  text: string;
  error?: string;
};

type CategoryScore = {
  name: string;
  score: number;
  weight: number;
  matched: string[];
  missing: string[];
};

type ResumeMatch = {
  rank: number;
  score: number;
  fileName: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  categoryScores: CategoryScore[];
  summary: string;
};

type Category = {
  name: string;
  weight: number;
  jdTerms: string[];
  triggers: string[];
  acceptedTerms: string[];
  expected: number;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "have",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
  "work",
  "working",
  "will",
  "you",
  "your",
  "role",
  "candidate",
  "candidates",
  "required",
  "preferred",
  "experience",
  "ability"
]);

const CATEGORIES: Category[] = [
  {
    name: "Core software engineering",
    weight: 16,
    jdTerms: [
      "software engineer",
      "software development",
      "customer facing applications",
      "customer-facing applications",
      "application",
      "applications",
      "api",
      "apis",
      "web application",
      "backend",
      "frontend",
      "full stack",
      "distributed",
      "microservices",
      "database",
      "data structures",
      "algorithms"
    ],
    triggers: ["general-purpose programming language", "design and develop", "software vendor"],
    acceptedTerms: [
      "software engineer",
      "software development",
      "api",
      "apis",
      "rest",
      "backend",
      "frontend",
      "full stack",
      "microservices",
      "distributed systems",
      "database",
      "sql",
      "application",
      "data structures",
      "algorithms"
    ],
    expected: 7
  },
  {
    name: "Languages and frameworks",
    weight: 12,
    jdTerms: [
      "python",
      "java",
      "javascript",
      "typescript",
      "c#",
      "c++",
      "go",
      "golang",
      "sql",
      "react",
      "node.js",
      "node",
      "spring boot",
      ".net"
    ],
    triggers: ["programming language", "general-purpose programming language"],
    acceptedTerms: [
      "python",
      "java",
      "javascript",
      "typescript",
      "c#",
      "c++",
      "go",
      "golang",
      "sql",
      "react",
      "node.js",
      "node",
      "spring boot",
      ".net"
    ],
    expected: 4
  },
  {
    name: "Cloud and DevOps",
    weight: 17,
    jdTerms: [
      "azure",
      "microsoft azure",
      "aws",
      "gcp",
      "cloud native",
      "cloud-native",
      "cloud hosted",
      "cloud-hosted",
      "cloud computing",
      "cloud technologies",
      "docker",
      "kubernetes",
      "ci/cd",
      "devops",
      "serverless"
    ],
    triggers: ["cloud", "large-scale", "deployment", "infrastructure"],
    acceptedTerms: [
      "azure",
      "microsoft azure",
      "azure devops",
      "aws",
      "gcp",
      "cloud native",
      "cloud-native",
      "cloud",
      "docker",
      "kubernetes",
      "ci/cd",
      "devops",
      "serverless",
      "terraform"
    ],
    expected: 4
  },
  {
    name: "Domain and modeling",
    weight: 20,
    jdTerms: [
      "actuarial",
      "insurance",
      "life insurance",
      "risk management",
      "risk",
      "financial modelling",
      "financial modeling",
      "modeling",
      "modelling",
      "reporting",
      "business planning",
      "product pricing",
      "pricing",
      "calculations",
      "payments",
      "fraud",
      "healthcare",
      "security",
      "analytics"
    ],
    triggers: ["domain knowledge", "business planning", "risk is modelled", "risk is modeled"],
    acceptedTerms: [
      "actuarial",
      "insurance",
      "life insurance",
      "risk management",
      "risk analytics",
      "risk",
      "financial modeling",
      "financial modelling",
      "modeling",
      "modelling",
      "reporting",
      "forecasting",
      "variance",
      "pricing",
      "pricing algorithms",
      "financial",
      "payments",
      "fraud",
      "healthcare",
      "security",
      "analytics"
    ],
    expected: 6
  },
  {
    name: "Agile and testing",
    weight: 14,
    jdTerms: [
      "agile",
      "scrum",
      "pair programming",
      "shared code ownership",
      "customer interaction",
      "tdd",
      "bdd",
      "unit tests",
      "unit test",
      "testing",
      "technical excellence",
      "continuous learning"
    ],
    triggers: ["write unit tests", "cover all requirements", "quality"],
    acceptedTerms: [
      "agile",
      "scrum",
      "pair programming",
      "shared code ownership",
      "tdd",
      "bdd",
      "unit tests",
      "unit test",
      "testing",
      "code reviews",
      "technical excellence",
      "continuous learning",
      "ci/cd"
    ],
    expected: 5
  },
  {
    name: "Requirements and delivery",
    weight: 9,
    jdTerms: [
      "requirements",
      "multiple work-streams",
      "multiple workstreams",
      "delivery phases",
      "self-direct",
      "self-directed",
      "changing requirements",
      "competitive cadence"
    ],
    triggers: ["get things done", "contribute and adapt", "delivery"],
    acceptedTerms: [
      "requirements",
      "stakeholder",
      "stakeholders",
      "ownership",
      "self-directed",
      "delivery",
      "cross-functional",
      "collaborate",
      "collaboration",
      "communication",
      "agile",
      "product"
    ],
    expected: 4
  },
  {
    name: "Education fit",
    weight: 7,
    jdTerms: [
      "computer science",
      "software engineering",
      "applied math",
      "applied mathematics",
      "economics",
      "actuarial science",
      "bachelor",
      "bachelor's",
      "master",
      "masters"
    ],
    triggers: ["bachelor's degree", "related field"],
    acceptedTerms: [
      "computer science",
      "software engineering",
      "applied math",
      "applied mathematics",
      "economics",
      "actuarial science",
      "bachelor",
      "bachelor's",
      "master",
      "masters",
      "gpa"
    ],
    expected: 2
  },
  {
    name: "Communication and customer focus",
    weight: 5,
    jdTerms: [
      "communicate technical information",
      "team collaboration",
      "team-focused",
      "customers",
      "customer",
      "consultants",
      "customer interaction",
      "innovative solutions"
    ],
    triggers: ["effectively communicate", "team collaboration"],
    acceptedTerms: [
      "communication",
      "communicate",
      "collaboration",
      "collaborate",
      "cross-functional",
      "customer",
      "customer-facing",
      "stakeholder",
      "stakeholders",
      "consulting"
    ],
    expected: 3
  }
];

export default function Home() {
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [targetScore, setTargetScore] = useState(94);
  const [jobDescription, setJobDescription] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    if (!jobDescription.trim() || resumes.length === 0) {
      return [];
    }

    return resumes
      .filter((resume) => !resume.error && resume.text.trim().length > 40)
      .map((resume) => scoreResume(resume, jobDescription))
      .sort((a, b) => b.score - a.score)
      .map((match, index) => ({ ...match, rank: index + 1 }));
  }, [jobDescription, resumes]);

  const best = matches[0];
  const hasTargetMatch = Boolean(best && best.score >= targetScore);

  async function handleFiles(files: FileList | File[]) {
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      setError("Please choose one or more PDF resumes.");
      return;
    }

    setError(null);
    setIsParsing(true);
    setProgress(`Reading 0/${pdfFiles.length} PDFs`);

    const parsed: ResumeDocument[] = [];
    for (let index = 0; index < pdfFiles.length; index += 1) {
      const file = pdfFiles[index];
      setProgress(`Reading ${index + 1}/${pdfFiles.length}: ${file.name}`);
      parsed.push(await parsePdfResume(file));
    }

    setResumes((current) => mergeById(current, parsed));
    setProgress(`Ready: ${parsed.length} PDF${parsed.length === 1 ? "" : "s"} parsed locally`);
    setIsParsing(false);
  }

  function clearAll() {
    setResumes([]);
    setJobDescription("");
    setProgress("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private AI-assisted ATS resume intelligence</p>
          <h1>AI Resume Matcher that runs in your browser.</h1>
          <p className="heroCopy">
            Upload resume PDFs, paste a job description, and get an ATS-style match score without
            sending resumes to a server. Everything is parsed and scored locally on your device.
          </p>
        </div>
        <div className="statusCard">
          <span className="statusLabel">Parsed resumes</span>
          <strong>{resumes.length}</strong>
          <span className="muted">{progress || "No files selected yet"}</span>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="workspace">
        <form className="panel controlPanel" onSubmit={(event) => event.preventDefault()}>
          <div className="panelHeader">
            <span>01</span>
            <div>
              <h2>Upload Resumes</h2>
              <p>Choose multiple PDF resumes. Files stay in this browser session only.</p>
            </div>
          </div>

          <div
            className="dropZone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <strong>Drop PDF resumes here</strong>
            <span>or choose files from your computer</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  void handleFiles(event.target.files);
                }
              }}
            />
          </div>

          <div className="actionRow">
            <button
              type="button"
              className="secondaryButton"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
            >
              {isParsing ? "Parsing PDFs..." : "Choose PDF resumes"}
            </button>
            <button type="button" className="ghostButton" onClick={clearAll} disabled={isParsing}>
              Clear session
            </button>
          </div>

          {resumes.length > 0 ? <ResumeSummary resumes={resumes} /> : null}

          <div className="panelHeader lower">
            <span>02</span>
            <div>
              <h2>Job Description</h2>
              <p>Paste the JD and choose the score needed before using an existing resume.</p>
            </div>
          </div>

          <label className="field compact">
            <span>Target ATS score</span>
            <input
              type="number"
              min={1}
              max={100}
              value={targetScore}
              onChange={(event) => setTargetScore(Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Job description</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full job description here..."
            />
          </label>
        </form>

        <section className="panel resultsPanel">
          <div className="panelHeader">
            <span>03</span>
            <div>
              <h2>Match Results</h2>
              <p>Ranked from strongest to weakest using local browser-side ATS scoring.</p>
            </div>
          </div>

          {matches.length === 0 ? <EmptyState /> : null}

          {matches.length > 0 ? (
            <>
              <div className={`verdict ${hasTargetMatch ? "good" : "warn"}`}>
                <div>
                  <span>{hasTargetMatch ? "Matched resume found" : "Tailoring recommended"}</span>
                  <strong>{best ? `${best.score.toFixed(1)}% best match` : "No match yet"}</strong>
                </div>
                <p>
                  {hasTargetMatch
                    ? `Use the top resume. It meets your ${targetScore}% target.`
                    : `No resume reached ${targetScore}%. Start from the closest match and tailor it.`}
                </p>
              </div>

              <div className="matchList">
                {matches.map((match) => (
                  <MatchCard key={`${match.rank}-${match.fileName}`} match={match} targetScore={targetScore} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

async function parsePdfResume(file: File): Promise<ResumeDocument> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;

  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ")
      );
    }

    return {
      id,
      fileName: file.name,
      size: file.size,
      pageCount: pdf.numPages,
      text: normalizeSpace(pages.join("\n"))
    };
  } catch (caught) {
    return {
      id,
      fileName: file.name,
      size: file.size,
      pageCount: 0,
      text: "",
      error: caught instanceof Error ? caught.message : "Could not parse PDF."
    };
  }
}

function scoreResume(resume: ResumeDocument, jobDescription: string): ResumeMatch {
  const jdNorm = normalizeForMatch(jobDescription);
  const resumeNorm = normalizeForMatch(resume.text);
  const jdTokens = countTokens(jobDescription);
  const resumeTokens = countTokens(resume.text);
  const categoryScores: CategoryScore[] = [];
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  let weightedTotal = 0;
  let applicableWeight = 0;

  for (const category of CATEGORIES) {
    const exactJdTerms = category.jdTerms.filter((term) => containsTerm(jdNorm, term));
    const triggerHit = category.triggers.some((term) => containsTerm(jdNorm, term));
    const requiredTerms = unique(exactJdTerms.length > 0 || triggerHit ? [...exactJdTerms, ...category.acceptedTerms] : []);

    if (requiredTerms.length === 0) {
      continue;
    }

    const matched = requiredTerms.filter((term) => containsTerm(resumeNorm, term));
    const missing = exactJdTerms.filter((term) => !containsTerm(resumeNorm, term));
    const coverage = Math.min(1, matched.length / Math.max(1, category.expected));
    const score = round(category.weight * coverage, 2);

    applicableWeight += category.weight;
    weightedTotal += score;
    matchedKeywords.push(...matched.slice(0, 8));
    missingKeywords.push(...missing.slice(0, 8));
    categoryScores.push({
      name: category.name,
      score,
      weight: category.weight,
      matched: matched.slice(0, 12),
      missing: missing.slice(0, 12)
    });
  }

  const dynamicTerms = extractDynamicKeywords(jobDescription);
  const dynamicMatched = dynamicTerms.filter((term) => containsTerm(resumeNorm, term));
  const dynamicMissing = dynamicTerms.filter((term) => !containsTerm(resumeNorm, term));
  const dynamicCoverage = dynamicMatched.length / Math.max(1, Math.min(18, dynamicTerms.length));
  const lexical = lexicalSimilarity(jdTokens, resumeTokens);
  const categoryBase =
    applicableWeight > 0 ? 85 * (weightedTotal / applicableWeight) : 80 * Math.min(1, dynamicCoverage);
  const score = round(Math.max(0, Math.min(100, categoryBase + 10 * Math.min(1, dynamicCoverage) + 5 * lexical)), 1);

  return {
    rank: 0,
    score,
    fileName: resume.fileName,
    matchedKeywords: unique([...matchedKeywords, ...dynamicMatched]).slice(0, 28),
    missingKeywords: unique([...missingKeywords, ...dynamicMissing]).slice(0, 22),
    categoryScores,
    summary: buildSummary(categoryScores, dynamicMissing)
  };
}

function ResumeSummary({ resumes }: { resumes: ResumeDocument[] }) {
  const failed = resumes.filter((resume) => resume.error).length;
  const parsed = resumes.length - failed;

  return (
    <div className="indexSummary">
      <div>
        <strong>{resumes.length}</strong>
        <span>selected</span>
      </div>
      <div>
        <strong>{parsed}</strong>
        <span>parsed</span>
      </div>
      <div>
        <strong>{failed}</strong>
        <span>failed</span>
      </div>
      <div>
        <strong>{resumes.reduce((total, resume) => total + resume.pageCount, 0)}</strong>
        <span>pages</span>
      </div>
      <div>
        <strong>{formatBytes(resumes.reduce((total, resume) => total + resume.size, 0))}</strong>
        <span>local only</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="emptyState">
      <div className="orb" />
      <h3>No match run yet</h3>
      <p>
        Upload one or more PDF resumes and paste a JD. This public version runs fully in your
        browser, so resumes are never uploaded to GitHub or any backend server.
      </p>
    </div>
  );
}

function MatchCard({ match, targetScore }: { match: ResumeMatch; targetScore: number }) {
  const isTarget = match.score >= targetScore;

  return (
    <article className="matchCard">
      <div className="matchTop">
        <div>
          <span className="rank">#{match.rank}</span>
          <h3>{match.fileName}</h3>
          <p>{match.summary}</p>
        </div>
        <div className={`score ${isTarget ? "scoreGood" : ""}`}>
          <strong>{match.score.toFixed(1)}%</strong>
          <span>{isTarget ? "meets target" : "below target"}</span>
        </div>
      </div>

      <div className="keywordGrid">
        <KeywordBlock title="Matched keywords" keywords={match.matchedKeywords} />
        <KeywordBlock title="Missing keywords" keywords={match.missingKeywords} muted />
      </div>

      <div className="categoryGrid">
        {match.categoryScores.map((category) => (
          <div className="category" key={category.name}>
            <div className="categoryTop">
              <span>{category.name}</span>
              <strong>
                {category.score.toFixed(1)}/{category.weight}
              </strong>
            </div>
            <div className="bar">
              <span style={{ width: `${Math.min(100, (category.score / category.weight) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function KeywordBlock({
  title,
  keywords,
  muted = false
}: {
  title: string;
  keywords: string[];
  muted?: boolean;
}) {
  return (
    <div className={muted ? "keywordBlock mutedBlock" : "keywordBlock"}>
      <h4>{title}</h4>
      <div className="chips">
        {keywords.slice(0, 18).map((keyword) => (
          <span key={keyword}>{keyword}</span>
        ))}
        {keywords.length === 0 ? <em>None</em> : null}
      </div>
    </div>
  );
}

function extractDynamicKeywords(text: string) {
  const tokens = tokenize(text);
  const phrases = new Map<string, number>();

  for (const token of tokens) {
    phrases.set(token, (phrases.get(token) || 0) + 1);
  }

  for (const width of [2, 3]) {
    for (let index = 0; index <= tokens.length - width; index += 1) {
      const window = tokens.slice(index, index + width);
      if (window.some((token) => STOPWORDS.has(token) || token.length <= 2)) {
        continue;
      }
      const phrase = window.join(" ");
      phrases.set(phrase, (phrases.get(phrase) || 0) + (width === 2 ? 2 : 3));
    }
  }

  return Array.from(phrases.entries())
    .map(([phrase, count]) => [phrase, count + semanticSignalBoost(phrase)] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([phrase]) => phrase)
    .slice(0, 35);
}

function semanticSignalBoost(phrase: string) {
  return [
    "azure",
    "aws",
    "cloud",
    "actuarial",
    "insurance",
    "risk",
    "modeling",
    "modelling",
    "pricing",
    "reporting",
    "agile",
    "unit",
    "tests",
    "algorithms",
    "data",
    "customer",
    "react",
    "python",
    "java",
    "sql"
  ].reduce((total, signal) => total + (phrase.includes(signal) ? 4 : 0), 0);
}

function buildSummary(categoryScores: CategoryScore[], missingKeywords: string[]) {
  const strongest = categoryScores
    .filter((item) => item.weight && item.score / item.weight >= 0.75)
    .map((item) => item.name)
    .slice(0, 3);
  const weakest = categoryScores
    .filter((item) => item.weight && item.score / item.weight < 0.45)
    .map((item) => item.name)
    .slice(0, 2);

  if (strongest.length > 0 && weakest.length > 0) {
    return `Strong in ${strongest.join(", ")}; weaker in ${weakest.join(", ")}.`;
  }
  if (strongest.length > 0) {
    return `Strong alignment in ${strongest.join(", ")}.`;
  }
  if (missingKeywords.length > 0) {
    return `Needs tailoring around ${missingKeywords.slice(0, 4).join(", ")}.`;
  }
  return "Moderate overlap, but this resume likely needs tailoring.";
}

function lexicalSimilarity(jdTokens: Map<string, number>, resumeTokens: Map<string, number>) {
  let dot = 0;
  let jdNorm = 0;
  let resumeNorm = 0;

  for (const count of jdTokens.values()) {
    jdNorm += count * count;
  }
  for (const count of resumeTokens.values()) {
    resumeNorm += count * count;
  }
  for (const [token, count] of jdTokens.entries()) {
    dot += count * (resumeTokens.get(token) || 0);
  }

  if (jdNorm === 0 || resumeNorm === 0) {
    return 0;
  }

  return Math.min(1, (dot / (Math.sqrt(jdNorm) * Math.sqrt(resumeNorm))) * 2.4);
}

function countTokens(text: string) {
  return tokenize(text).reduce((counts, token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function tokenize(text: string) {
  return normalizeForMatch(text)
    .match(/[a-z0-9+#.]+/g)
    ?.map((token) => (token === ".net" ? token : token.replace(/\.+$/g, "")))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token)) ?? [];
}

function containsTerm(normalizedText: string, term: string) {
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) {
    return false;
  }
  return new RegExp(`(?<![a-z0-9+#.])${escapeRegExp(normalizedTerm)}(?![a-z0-9+#.])`).test(normalizedText);
}

function normalizeForMatch(text: string) {
  return normalizeSpace(
    text
      .toLowerCase()
      .replaceAll("-", " ")
      .replaceAll("node js", "node.js")
      .replaceAll("ci cd", "ci/cd")
      .replaceAll("tdd bdd", "tdd/bdd")
      .replace(/[^a-z0-9+#./'\s]+/g, " ")
  );
}

function normalizeSpace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function mergeById(current: ResumeDocument[], incoming: ResumeDocument[]) {
  const merged = new Map(current.map((resume) => [resume.id, resume]));
  for (const resume of incoming) {
    merged.set(resume.id, resume);
  }
  return Array.from(merged.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${round(bytes / (1024 * 1024), 1)} MB`;
}
