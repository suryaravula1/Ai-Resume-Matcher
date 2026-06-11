import { NextResponse } from "next/server";

import { getDefaultFolderPath, runResumeEngine } from "../../../lib/resumeEngine";

type IndexResponse = {
  folder: string;
  db_path: string;
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  deactivated: number;
  active_count: number;
  failures: Array<{ path: string; error: string }>;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const folderPath = String(body.folderPath || getDefaultFolderPath()).trim();

    if (!folderPath) {
      return NextResponse.json({ ok: false, error: "Folder path is required." }, { status: 400 });
    }

    const result = await runResumeEngine<IndexResponse>(["index", "--folder", folderPath]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to index resumes." },
      { status: 500 }
    );
  }
}
