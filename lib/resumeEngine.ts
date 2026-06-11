import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  ".data",
  "resume_matcher.sqlite3"
);
const ENGINE_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "scripts",
  "resume_engine.py"
);

export type EngineResult<T> = T & {
  ok: boolean;
};

export function getDefaultFolderPath() {
  return process.env.RESUME_MATCHER_FOLDER || "";
}

export async function runResumeEngine<T>(
  args: string[],
  input?: unknown
): Promise<EngineResult<T>> {
  const python = resolvePython();
  const childArgs = [ENGINE_PATH, "--db", process.env.RESUME_MATCHER_DB || DEFAULT_DB_PATH, ...args];

  return new Promise((resolve, reject) => {
    const child = spawn(python, childArgs, {
      cwd: /*turbopackIgnore: true*/ process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Resume engine exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Resume engine returned invalid JSON. ${error instanceof Error ? error.message : ""}\n${stdout}`
          )
        );
      }
    });

    if (typeof input !== "undefined") {
      child.stdin.write(JSON.stringify(input));
    }
    child.stdin.end();
  });
}

function resolvePython() {
  if (process.env.RESUME_MATCHER_PYTHON) {
    return process.env.RESUME_MATCHER_PYTHON;
  }

  return "python3";
}
