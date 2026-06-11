#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sqlite3
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - surfaced clearly through the API
    PdfReader = None
    PYPDF_IMPORT_ERROR = exc
else:
    PYPDF_IMPORT_ERROR = None


STOPWORDS = {
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
    "ability",
}


@dataclass(frozen=True)
class Category:
    name: str
    weight: float
    exact_terms: tuple[str, ...]
    triggers: tuple[str, ...]
    accepted_terms: tuple[str, ...]
    expected: int


CATEGORIES = (
    Category(
        name="Core software engineering",
        weight=16,
        exact_terms=(
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
            "algorithms",
        ),
        triggers=("general-purpose programming language", "design and develop", "software vendor"),
        accepted_terms=(
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
        ),
        expected=7,
    ),
    Category(
        name="Languages and frameworks",
        weight=12,
        exact_terms=(
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
            ".net",
        ),
        triggers=("programming language", "general-purpose programming language"),
        accepted_terms=(
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
            ".net",
        ),
        expected=4,
    ),
    Category(
        name="Azure and cloud",
        weight=17,
        exact_terms=(
            "azure",
            "microsoft azure",
            "azure partner",
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
            "serverless",
        ),
        triggers=("cloud", "large-scale financial modelling", "large-scale financial modeling"),
        accepted_terms=(
            "azure",
            "microsoft azure",
            "azure devops",
            "cloud native",
            "cloud-native",
            "cloud",
            "aws",
            "gcp",
            "docker",
            "kubernetes",
            "ci/cd",
            "devops",
            "serverless",
            "terraform",
        ),
        expected=4,
    ),
    Category(
        name="Actuarial, insurance, risk, and modeling",
        weight=20,
        exact_terms=(
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
            "retirement",
            "economics",
            "applied math",
            "applied mathematics",
        ),
        triggers=("actuarial technology", "life insurers", "risk is modelled", "risk is modeled"),
        accepted_terms=(
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
            "economics",
        ),
        expected=6,
    ),
    Category(
        name="Agile and testing",
        weight=14,
        exact_terms=(
            "agile",
            "pair programming",
            "shared code ownership",
            "customer interaction",
            "tdd",
            "bdd",
            "unit tests",
            "unit test",
            "testing",
            "technical excellence",
            "continuous learning",
        ),
        triggers=("write unit tests", "cover all requirements"),
        accepted_terms=(
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
            "ci/cd",
        ),
        expected=5,
    ),
    Category(
        name="Requirements and delivery",
        weight=9,
        exact_terms=(
            "requirements",
            "multiple work-streams",
            "multiple workstreams",
            "delivery phases",
            "self-direct",
            "self-directed",
            "changing requirements",
            "competitive cadence",
        ),
        triggers=("get things done", "contribute and adapt"),
        accepted_terms=(
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
            "product",
        ),
        expected=4,
    ),
    Category(
        name="Education fit",
        weight=7,
        exact_terms=(
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
        ),
        triggers=("bachelor's degree", "related field"),
        accepted_terms=(
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
            "gpa",
        ),
        expected=2,
    ),
    Category(
        name="Communication and customer focus",
        weight=5,
        exact_terms=(
            "communicate technical information",
            "team collaboration",
            "team-focused",
            "customers",
            "customer",
            "consultants",
            "customer interaction",
            "innovative solutions",
        ),
        triggers=("effectively communicate", "team collaboration"),
        accepted_terms=(
            "communication",
            "communicate",
            "collaboration",
            "collaborate",
            "cross-functional",
            "customer",
            "customer-facing",
            "stakeholder",
            "stakeholders",
            "consulting",
        ),
        expected=3,
    ),
)


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Resume Matcher indexing and ATS-style scoring engine")
    parser.add_argument("--db", required=True, help="Path to the SQLite database")
    subparsers = parser.add_subparsers(dest="command", required=True)

    index_parser = subparsers.add_parser("index")
    index_parser.add_argument("--folder", required=True)

    subparsers.add_parser("match")
    subparsers.add_parser("status")

    args = parser.parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
      conn.row_factory = sqlite3.Row
      ensure_schema(conn)

      if args.command == "index":
          result = index_folder(conn, db_path, Path(args.folder).expanduser())
      elif args.command == "match":
          payload = read_stdin_json()
          result = match_resumes(conn, payload)
      elif args.command == "status":
          payload = read_stdin_json()
          result = status(conn, db_path, payload)
      else:
          raise ValueError(f"Unknown command: {args.command}")

    print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    return 0


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            folder_name TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_mtime REAL NOT NULL,
            text_hash TEXT NOT NULL,
            extracted_text TEXT NOT NULL,
            word_count INTEGER NOT NULL,
            page_count INTEGER NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            indexed_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_resumes_active ON resumes(active)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_resumes_path ON resumes(file_path)")
    try:
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS resume_fts
            USING fts5(file_name, relative_path, extracted_text)
            """
        )
    except sqlite3.OperationalError:
        # Some SQLite builds omit FTS5. The app still works because scoring reads
        # normalized text from the main table.
        pass
    conn.commit()


def index_folder(conn: sqlite3.Connection, db_path: Path, folder: Path) -> dict[str, Any]:
    if PdfReader is None:
        raise RuntimeError(f"pypdf is required for PDF extraction: {PYPDF_IMPORT_ERROR}")

    folder = folder.resolve()
    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Folder does not exist: {folder}")

    pdfs = sorted(path for path in folder.rglob("*.pdf") if path.is_file())
    existing = {
        row["file_path"]: row
        for row in conn.execute(
            "SELECT id, file_path, file_size, file_mtime, extracted_text FROM resumes"
        ).fetchall()
    }

    stats = {
        "folder": str(folder),
        "db_path": str(db_path),
        "discovered": len(pdfs),
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "failed": 0,
        "deactivated": 0,
        "failures": [],
    }

    seen_paths: set[str] = set()

    for pdf_path in pdfs:
        absolute_path = str(pdf_path.resolve())
        seen_paths.add(absolute_path)
        stat = pdf_path.stat()
        previous = existing.get(absolute_path)

        if (
            previous
            and previous["file_size"] == stat.st_size
            and abs(float(previous["file_mtime"]) - stat.st_mtime) < 0.0001
            and previous["extracted_text"]
        ):
            conn.execute("UPDATE resumes SET active = 1 WHERE id = ?", (previous["id"],))
            stats["skipped"] += 1
            continue

        try:
            extracted_text, page_count = extract_pdf_text(pdf_path)
            if len(extracted_text.strip()) < 40:
                raise ValueError("No readable text extracted from PDF.")
            text_hash = hashlib.sha256(normalize_space(extracted_text).encode("utf-8")).hexdigest()
            relative_path = str(pdf_path.relative_to(folder))
            folder_name = str(pdf_path.parent.relative_to(folder)) or "."
            indexed_at = datetime.now(timezone.utc).isoformat()

            if previous:
                conn.execute(
                    """
                    UPDATE resumes
                    SET file_name = ?, folder_name = ?, relative_path = ?, file_size = ?,
                        file_mtime = ?, text_hash = ?, extracted_text = ?, word_count = ?,
                        page_count = ?, active = 1, indexed_at = ?
                    WHERE id = ?
                    """,
                    (
                        pdf_path.name,
                        folder_name,
                        relative_path,
                        stat.st_size,
                        stat.st_mtime,
                        text_hash,
                        extracted_text,
                        len(tokenize(extracted_text)),
                        page_count,
                        indexed_at,
                        previous["id"],
                    ),
                )
                resume_id = int(previous["id"])
                stats["updated"] += 1
            else:
                cursor = conn.execute(
                    """
                    INSERT INTO resumes (
                        file_path, file_name, folder_name, relative_path, file_size,
                        file_mtime, text_hash, extracted_text, word_count, page_count,
                        active, indexed_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                    """,
                    (
                        absolute_path,
                        pdf_path.name,
                        folder_name,
                        relative_path,
                        stat.st_size,
                        stat.st_mtime,
                        text_hash,
                        extracted_text,
                        len(tokenize(extracted_text)),
                        page_count,
                        indexed_at,
                    ),
                )
                resume_id = int(cursor.lastrowid)
                stats["inserted"] += 1

            refresh_fts(conn, resume_id, pdf_path.name, relative_path, extracted_text)
        except Exception as exc:  # noqa: BLE001
            stats["failed"] += 1
            stats["failures"].append({"path": absolute_path, "error": str(exc)})

    folder_prefix = str(folder) + "/"
    for row in conn.execute("SELECT id, file_path FROM resumes WHERE active = 1").fetchall():
        row_path = str(row["file_path"])
        if row_path.startswith(folder_prefix) and row_path not in seen_paths:
            conn.execute("UPDATE resumes SET active = 0 WHERE id = ?", (row["id"],))
            stats["deactivated"] += 1

    conn.commit()
    stats["active_count"] = active_count(conn)
    return stats


def extract_pdf_text(pdf_path: Path) -> tuple[str, int]:
    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return normalize_space("\n".join(pages)), len(reader.pages)


def refresh_fts(
    conn: sqlite3.Connection,
    resume_id: int,
    file_name: str,
    relative_path: str,
    extracted_text: str,
) -> None:
    try:
        conn.execute("DELETE FROM resume_fts WHERE rowid = ?", (resume_id,))
        conn.execute(
            "INSERT INTO resume_fts(rowid, file_name, relative_path, extracted_text) VALUES (?, ?, ?, ?)",
            (resume_id, file_name, relative_path, extracted_text),
        )
    except sqlite3.OperationalError:
        pass


def match_resumes(conn: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    job_description = str(payload.get("job_description", "")).strip()
    target_score = float(payload.get("target_score", 94))
    limit = max(1, min(50, int(payload.get("limit", 12))))

    if not job_description:
        raise ValueError("job_description is required.")

    rows = conn.execute(
        """
        SELECT id, file_path, file_name, folder_name, relative_path, extracted_text, word_count
        FROM resumes
        WHERE active = 1 AND extracted_text != ''
        """
    ).fetchall()

    scored = [score_resume(row, job_description) for row in rows]
    scored.sort(key=lambda item: item["score"], reverse=True)

    for index, item in enumerate(scored, start=1):
        item["rank"] = index

    best_score = scored[0]["score"] if scored else 0
    recommendation = "no_resumes"
    if scored:
        recommendation = "use_existing" if best_score >= target_score else "create_new"

    return {
        "target_score": round(target_score, 1),
        "active_resume_count": len(rows),
        "has_target_match": bool(scored and best_score >= target_score),
        "recommendation": recommendation,
        "matches": scored[:limit],
    }


def score_resume(row: sqlite3.Row, job_description: str) -> dict[str, Any]:
    jd_norm = normalize_for_match(job_description)
    resume_text = str(row["extracted_text"])
    resume_norm = normalize_for_match(resume_text)
    jd_tokens = Counter(tokenize(job_description))
    resume_tokens = Counter(tokenize(resume_text))

    category_scores = []
    exact_matched_keywords: list[str] = []
    exact_missing_keywords: list[str] = []
    weighted_total = 0.0
    applicable_weight = 0.0

    for category in CATEGORIES:
        required_terms, exact_jd_terms = category_terms_for_jd(category, jd_norm)
        if not required_terms:
            continue

        applicable_weight += category.weight
        matched = unique_sorted(term for term in required_terms if contains_term(resume_norm, term))
        missing = unique_sorted(term for term in exact_jd_terms if not contains_term(resume_norm, term))

        coverage = min(1.0, len(matched) / max(1, category.expected))
        score = round(category.weight * coverage, 2)

        weighted_total += score
        exact_matched_keywords.extend(matched[:8])
        exact_missing_keywords.extend(missing[:8])
        category_scores.append(
            {
                "name": category.name,
                "score": score,
                "weight": category.weight,
                "matched": matched[:12],
                "missing": missing[:12],
            }
        )

    dynamic_terms = extract_dynamic_keywords(job_description)
    dynamic_matched = [term for term in dynamic_terms if contains_term(resume_norm, term)]
    dynamic_missing = [term for term in dynamic_terms if not contains_term(resume_norm, term)]
    dynamic_score = 5.0 * min(1.0, len(dynamic_matched) / max(1, min(18, len(dynamic_terms))))

    lexical_score = 5.0 * lexical_similarity(jd_tokens, resume_tokens)
    normalized_category_score = 90.0 * (weighted_total / max(1.0, applicable_weight))
    raw_score = normalized_category_score + dynamic_score + lexical_score
    final_score = round(max(0.0, min(100.0, raw_score)), 1)

    matched_keywords = unique_sorted([*exact_matched_keywords, *dynamic_matched])[:28]
    missing_keywords = unique_sorted([*exact_missing_keywords, *dynamic_missing])[:22]
    summary = build_summary(category_scores, missing_keywords)

    return {
        "rank": 0,
        "score": final_score,
        "file_path": row["file_path"],
        "file_name": row["file_name"],
        "relative_path": row["relative_path"],
        "folder_name": row["folder_name"],
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "category_scores": category_scores,
        "summary": summary,
    }


def category_terms_for_jd(category: Category, jd_norm: str) -> tuple[list[str], list[str]]:
    exact_jd_terms = [term for term in category.exact_terms if contains_term(jd_norm, term)]
    trigger_hit = any(contains_term(jd_norm, trigger) for trigger in category.triggers)

    if exact_jd_terms:
        accepted = [*exact_jd_terms, *category.accepted_terms]
    elif trigger_hit:
        accepted = list(category.accepted_terms)
    else:
        accepted = []

    return unique_sorted(accepted), unique_sorted(exact_jd_terms)


def lexical_similarity(jd_tokens: Counter[str], resume_tokens: Counter[str]) -> float:
    if not jd_tokens or not resume_tokens:
        return 0.0

    shared = set(jd_tokens) & set(resume_tokens)
    dot = sum(jd_tokens[token] * resume_tokens[token] for token in shared)
    jd_norm = math.sqrt(sum(count * count for count in jd_tokens.values()))
    resume_norm = math.sqrt(sum(count * count for count in resume_tokens.values()))

    if jd_norm == 0 or resume_norm == 0:
        return 0.0

    # Cosine on raw resume/JD tokens is intentionally capped because long resumes
    # can otherwise look deceptively strong from generic overlap.
    return min(1.0, (dot / (jd_norm * resume_norm)) * 2.4)


def extract_dynamic_keywords(text: str) -> list[str]:
    tokens = tokenize(text)
    phrases: Counter[str] = Counter()

    for token in tokens:
        if token not in STOPWORDS and len(token) > 2:
            phrases[token] += 1

    for width in (2, 3):
        for index in range(0, max(0, len(tokens) - width + 1)):
            window = tokens[index : index + width]
            if any(token in STOPWORDS or len(token) <= 2 for token in window):
                continue
            phrase = " ".join(window)
            phrases[phrase] += 2 if width == 2 else 3

    boosted = []
    for phrase, count in phrases.items():
        boost = 0
        for signal in (
            "azure",
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
        ):
            if signal in phrase:
                boost += 4
        boosted.append((count + boost, phrase))

    boosted.sort(key=lambda item: (-item[0], item[1]))
    result = []
    for _, phrase in boosted:
        if len(result) >= 35:
            break
        if phrase not in result:
            result.append(phrase)
    return result


def build_summary(category_scores: list[dict[str, Any]], missing_keywords: list[str]) -> str:
    strongest = [
        item["name"]
        for item in category_scores
        if item["weight"] and item["score"] / item["weight"] >= 0.75
    ][:3]
    weakest = [
        item["name"]
        for item in category_scores
        if item["weight"] and item["score"] / item["weight"] < 0.45
    ][:2]

    if strongest and weakest:
        return f"Strong in {', '.join(strongest)}; weaker in {', '.join(weakest)}."
    if strongest:
        return f"Strong alignment in {', '.join(strongest)}."
    if missing_keywords:
        return f"Needs tailoring around {', '.join(missing_keywords[:4])}."
    return "Moderate overlap, but this resume likely needs tailoring."


def status(conn: sqlite3.Connection, db_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    total = conn.execute("SELECT COUNT(*) FROM resumes").fetchone()[0]
    active = active_count(conn)
    last_indexed = conn.execute("SELECT MAX(indexed_at) FROM resumes").fetchone()[0]
    return {
        "db_path": str(db_path),
        "default_folder": str(payload.get("default_folder", "")),
        "active_count": active,
        "total_count": total,
        "last_indexed_at": last_indexed,
    }


def active_count(conn: sqlite3.Connection) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM resumes WHERE active = 1").fetchone()[0])


def read_stdin_json() -> dict[str, Any]:
    content = sys.stdin.read().strip()
    if not content:
        return {}
    return json.loads(content)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_for_match(text: str) -> str:
    text = text.lower()
    text = text.replace("-", " ")
    text = text.replace("node js", "node.js")
    text = text.replace("ci cd", "ci/cd")
    text = text.replace("tdd bdd", "tdd/bdd")
    text = re.sub(r"[^a-z0-9+#./'-]+", " ", text)
    return normalize_space(text)


def tokenize(text: str) -> list[str]:
    normalized = normalize_for_match(text)
    tokens = []
    for raw_token in re.findall(r"[a-z0-9+#.]+", normalized):
        token = raw_token if raw_token == ".net" else raw_token.strip(".")
        if token not in STOPWORDS and len(token) > 1:
            tokens.append(token)
    return tokens


def contains_term(normalized_text: str, term: str) -> bool:
    normalized_term = normalize_for_match(term)
    if not normalized_term:
        return False
    pattern = r"(?<![a-z0-9+#.])" + re.escape(normalized_term) + r"(?![a-z0-9+#.])"
    return re.search(pattern, normalized_text) is not None


def unique_sorted(items: Any) -> list[str]:
    seen = set()
    result = []
    for item in items:
        value = str(item).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
