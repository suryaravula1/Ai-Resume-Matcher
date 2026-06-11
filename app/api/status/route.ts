import { NextResponse } from "next/server";

import { getDefaultFolderPath, runResumeEngine } from "../../../lib/resumeEngine";

export async function GET() {
  try {
    const result = await runResumeEngine(["status"], {
      default_folder: getDefaultFolderPath()
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to read index status." },
      { status: 500 }
    );
  }
}
