#!/usr/bin/env python3
"""Verify that the DUGA draft schema, disposable fixture and Console SQL agree."""
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise AssertionError(message)


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        fail(f"Missing file: {relative}")
    return path.read_text(encoding="utf-8")


def without_line_comments(source: str) -> str:
    lines = [line for line in source.splitlines()
             if not line.lstrip().startswith("--")]
    return "\n".join(lines).strip()


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    return db


def schema_snapshot(db: sqlite3.Connection):
    return db.execute("""
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%'
          AND type IN ('table', 'index', 'trigger')
        ORDER BY type, name
    """).fetchall()


def main() -> int:
    draft_sql = read("governance/schemas/d1-operational-schema.sql")
    fixture_sql = read("scripts/duga-d1-disposable-acceptance-fixture.sql")
    console_sql = read("scripts/duga-d1-disposable-acceptance-console.sql")

    if without_line_comments(fixture_sql) != without_line_comments(console_sql):
        fail("Disposable fixture and comment-free Console SQL are not identical.")

    draft_db = connect()
    draft_db.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
    draft_db.executescript(draft_sql)

    fixture_db = connect()
    fixture_db.executescript(fixture_sql)

    console_db = connect()
    console_db.executescript(console_sql)

    expected = schema_snapshot(draft_db)
    if schema_snapshot(fixture_db) != expected:
        fail("Disposable fixture schema differs from the operational schema draft.")
    if schema_snapshot(console_db) != expected:
        fail("Console SQL schema differs from the operational schema draft.")

    names = {row[1] for row in expected}
    required = {
        "duga_assignments", "duga_change_requests", "duga_reviews",
        "duga_approvals", "duga_validation_runs", "duga_audit_events",
        "duga_analysis_findings", "duga_jobs",
        "idx_duga_changes_parent", "duga_change_parent_immutable",
        "duga_audit_no_update", "duga_audit_no_delete",
    }
    missing = sorted(required - names)
    if missing:
        fail(f"Required revised schema objects are missing: {', '.join(missing)}")

    change_columns = {
        row[1] for row in fixture_db.execute("PRAGMA table_info(duga_change_requests)")
    }
    if "parent_change_request_id" not in change_columns:
        fail("Revised predecessor-link column is missing.")

    review_sql = next(
        row[0] for row in fixture_db.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='duga_reviews'"
        )
    )
    if "reviewer_type='human' OR decision<>'rejected'" not in review_sql:
        fail("AI review terminal-rejection guard is missing.")

    for label, db in (
        ("draft", draft_db), ("fixture", fixture_db), ("console", console_db)
    ):
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            fail(f"{label} schema has foreign-key violations: {violations!r}")

    print(
        "PASS: draft, disposable fixture and Console SQL produce identical "
        "SQLite schema objects; predecessor and AI-review constraints are present."
    )
    print("NOTE: Local SQLite source parity only; this is not Cloudflare D1 acceptance.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, sqlite3.Error) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
