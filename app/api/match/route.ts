import { NextResponse } from "next/server";

import { getDefaultFolderPath, runResumeEngine } from "../../../lib/resumeEngine";

type MatchResponse = {
  target_score: number;
  active_resume_count: number;
  has_target_match: boolean;
  recommendation: "use_existing" | "create_new" | "no_resumes";
  matches: Array<{
    rank: number;
    score: number;
    file_path: string;
    file_name: string;
    relative_path: string;
    folder_name: string;
    matched_keywords: string[];
    missing_keywords: string[];
    category_scores: Array<{ name: string; score: number; weight: number; matched: string[]; missing: string[] }>;
    summary: string;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jobDescription = String(body.jobDescription || "").trim();
    const folderPath = String(body.folderPath || getDefaultFolderPath()).trim();
    const targetScore = Number(body.targetScore || 94);
    const refreshIndex = Boolean(body.refreshIndex);

    if (!jobDescription) {
      return NextResponse.json({ ok: false, error: "Paste a job description first." }, { status: 400 });
    }

    if (refreshIndex) {
      await runResumeEngine(["index", "--folder", folderPath]);
    }

    const result = await runResumeEngine<MatchResponse>(
      ["match"],
      {
        job_description: jobDescription,
        target_score: Number.isFinite(targetScore) ? targetScore : 94,
        limit: 12
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to score resumes." },
      { status: 500 }
    );
  }
}
