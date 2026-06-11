"use client";

import { useEffect, useState } from "react";

type IndexStats = {
  ok: boolean;
  folder: string;
  db_path: string;
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  deactivated: number;
  active_count: number;
  failures?: Array<{ path: string; error: string }>;
  error?: string;
};

type StatusResponse = {
  ok: boolean;
  db_path: string;
  default_folder: string;
  active_count: number;
  total_count: number;
  last_indexed_at: string | null;
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
  file_path: string;
  file_name: string;
  relative_path: string;
  folder_name: string;
  matched_keywords: string[];
  missing_keywords: string[];
  category_scores: CategoryScore[];
  summary: string;
};

type MatchResponse = {
  ok: boolean;
  target_score: number;
  active_resume_count: number;
  has_target_match: boolean;
  recommendation: "use_existing" | "create_new" | "no_resumes";
  matches: ResumeMatch[];
  error?: string;
};

const DEFAULT_JD = "";

export default function Home() {
  const [folderPath, setFolderPath] = useState("");
  const [targetScore, setTargetScore] = useState(94);
  const [jobDescription, setJobDescription] = useState(DEFAULT_JD);
  const [refreshIndex, setRefreshIndex] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState<"status" | "index" | "match" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading("status");
    setError(null);

    try {
      const response = await fetch("/api/status");
      const data = (await response.json()) as StatusResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not read index status.");
      }

      setStatus(data);
      if (data.default_folder) {
        setFolderPath(data.default_folder);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read index status.");
    } finally {
      setLoading(null);
    }
  }

  async function indexResumes() {
    setLoading("index");
    setError(null);
    setIndexStats(null);

    try {
      const response = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath })
      });
      const data = (await response.json()) as IndexStats;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Indexing failed.");
      }

      setIndexStats(data);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Indexing failed.");
    } finally {
      setLoading(null);
    }
  }

  async function matchResumes() {
    setLoading("match");
    setError(null);
    setMatchResult(null);

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, jobDescription, targetScore, refreshIndex })
      });
      const data = (await response.json()) as MatchResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Matching failed.");
      }

      setMatchResult(data);
      if (refreshIndex) {
        await loadStatus();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Matching failed.");
    } finally {
      setLoading(null);
    }
  }

  const best = matchResult?.matches[0];
  const canMatch = jobDescription.trim().length > 40 && !loading;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Local ATS-style resume intelligence</p>
          <h1>Paste a job description. Find the best resume in seconds.</h1>
          <p className="heroCopy">
            The app indexes your PDFs into SQLite once, skips unchanged files, then ranks stored resumes
            against a JD with transparent category scores and missing keywords.
          </p>
        </div>
        <div className="statusCard">
          <span className="statusLabel">Indexed resumes</span>
          <strong>{status?.active_count ?? "0"}</strong>
          <span className="muted">
            {status?.last_indexed_at ? `Last indexed ${formatDate(status.last_indexed_at)}` : "No index yet"}
          </span>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="workspace">
        <form className="panel controlPanel" onSubmit={(event) => event.preventDefault()}>
          <div className="panelHeader">
            <span>01</span>
            <div>
              <h2>Resume Library</h2>
              <p>Point this at the folder that contains all company resume subfolders.</p>
            </div>
          </div>

          <label className="field">
            <span>Folder path</span>
            <input
              value={folderPath}
              onChange={(event) => setFolderPath(event.target.value)}
              placeholder="/path/to/your/resume-folder"
            />
          </label>

          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={indexResumes} disabled={!!loading}>
              {loading === "index" ? "Indexing..." : "Index / refresh PDFs"}
            </button>
            <button type="button" className="ghostButton" onClick={loadStatus} disabled={!!loading}>
              Refresh status
            </button>
          </div>

          {indexStats ? <IndexSummary stats={indexStats} /> : null}

          <div className="panelHeader lower">
            <span>02</span>
            <div>
              <h2>Job Description</h2>
              <p>Paste the JD and choose the score needed before reusing an existing resume.</p>
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

          <label className="check">
            <input
              type="checkbox"
              checked={refreshIndex}
              onChange={(event) => setRefreshIndex(event.target.checked)}
            />
            <span>Refresh changed PDFs before matching</span>
          </label>

          <label className="field">
            <span>Job description</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full job description here..."
            />
          </label>

          <button type="button" className="primaryButton" onClick={matchResumes} disabled={!canMatch}>
            {loading === "match" ? "Scoring resumes..." : "Find best resume"}
          </button>
        </form>

        <section className="panel resultsPanel">
          <div className="panelHeader">
            <span>03</span>
            <div>
              <h2>Match Results</h2>
              <p>Ranked from strongest to weakest using the current indexed database.</p>
            </div>
          </div>

          {!matchResult ? <EmptyState /> : null}

          {matchResult ? (
            <>
              <div className={`verdict ${matchResult.has_target_match ? "good" : "warn"}`}>
                <div>
                  <span>{matchResult.has_target_match ? "Matched resume found" : "Create a tailored resume"}</span>
                  <strong>
                    {best
                      ? `${Math.round(best.score * 10) / 10}% best match`
                      : "No indexed resumes available"}
                  </strong>
                </div>
                <p>
                  {matchResult.has_target_match
                    ? `Use the top existing resume. It meets your ${matchResult.target_score}% target.`
                    : `No resume reached ${matchResult.target_score}%. Start from the closest match and tailor it.`}
                </p>
              </div>

              <div className="matchList">
                {matchResult.matches.map((match) => (
                  <MatchCard key={match.file_path} match={match} targetScore={matchResult.target_score} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function IndexSummary({ stats }: { stats: IndexStats }) {
  return (
    <div className="indexSummary">
      <div>
        <strong>{stats.discovered}</strong>
        <span>PDFs found</span>
      </div>
      <div>
        <strong>{stats.inserted}</strong>
        <span>new</span>
      </div>
      <div>
        <strong>{stats.updated}</strong>
        <span>updated</span>
      </div>
      <div>
        <strong>{stats.skipped}</strong>
        <span>unchanged</span>
      </div>
      <div>
        <strong>{stats.failed}</strong>
        <span>failed</span>
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
        Index the resume folder, paste a JD, and the app will show the best file, ATS-style score,
        matching keywords, missing keywords, and category breakdown.
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
          <h3>{match.relative_path || match.file_name}</h3>
          <p>{match.summary}</p>
        </div>
        <div className={`score ${isTarget ? "scoreGood" : ""}`}>
          <strong>{match.score.toFixed(1)}%</strong>
          <span>{isTarget ? "meets target" : "below target"}</span>
        </div>
      </div>

      <div className="pathLine">{match.file_path}</div>

      <div className="keywordGrid">
        <KeywordBlock title="Matched keywords" keywords={match.matched_keywords} />
        <KeywordBlock title="Missing keywords" keywords={match.missing_keywords} muted />
      </div>

      <div className="categoryGrid">
        {match.category_scores.map((category) => (
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

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
