#!/usr/bin/env python3
"""Local SQLite smoke tests for the DUGA operational schema draft.

This test uses an in-memory database only. It does not connect to Cloudflare D1.
Run from the repository root:
    python scripts/test-duga-schema.py
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "governance" / "schemas" / "d1-operational-schema.sql"


def main() -> int:
    if not SCHEMA.is_file():
        print(f"FAIL: schema file not found: {SCHEMA}", file=sys.stderr)
        return 1

    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
    db.executemany("INSERT INTO users(id) VALUES (?)", [('human-1',), ('human-2',)])

    try:
        db.executescript(SCHEMA.read_text(encoding="utf-8"))
    except sqlite3.Error as exc:
        print(f"FAIL: schema execution: {exc}", file=sys.stderr)
        return 1

    passed: list[str] = []

    def check(name: str, operation, *, should_fail: bool) -> None:
        try:
            operation()
        except sqlite3.IntegrityError:
            if should_fail:
                passed.append(name)
                return
            raise AssertionError(f"{name}: unexpected integrity failure")
        if should_fail:
            raise AssertionError(f"{name}: invalid operation was accepted")
        passed.append(name)

    def insert_assignment(
        assignment_id: str,
        scope_type: str,
        scope_id: str | None,
        role_id: str,
        subject_type: str,
        user_id: str | None = None,
        principal_id: str | None = None,
    ) -> None:
        db.execute(
            """INSERT INTO duga_assignments
               (id,scope_type,scope_id,role_id,subject_type,user_id,
                principal_id,status,assigned_by_user_id,created_at)
               VALUES (?,?,?,?,?,?,?,'active','human-1',1)""",
            (assignment_id, scope_type, scope_id, role_id, subject_type,
             user_id, principal_id),
        )

    check(
        "valid human platform-owner",
        lambda: insert_assignment(
            "assignment-human-owner", "platform", None,
            "platform-owner", "human", user_id="human-1"
        ),
        should_fail=False,
    )
    check(
        "AI cannot hold platform-owner",
        lambda: insert_assignment(
            "assignment-ai-owner", "platform", None,
            "platform-owner", "ai", principal_id="agent-x"
        ),
        should_fail=True,
    )
    check(
        "human cannot hold independent-ai-auditor",
        lambda: insert_assignment(
            "assignment-human-auditor", "system", "DUSS",
            "independent-ai-auditor", "human", user_id="human-1"
        ),
        should_fail=True,
    )
    check(
        "AI maintainer requires system scope",
        lambda: insert_assignment(
            "assignment-ai-wrong-scope", "platform", None,
            "ai-maintainer", "ai", principal_id="agent-x"
        ),
        should_fail=True,
    )
    check(
        "valid system-scoped AI maintainer",
        lambda: insert_assignment(
            "assignment-ai-maintainer", "system", "DUSS",
            "ai-maintainer", "ai", principal_id="agent-x"
        ),
        should_fail=False,
    )
    db.execute(
        """INSERT INTO duga_change_requests
           (id,title,summary,rationale,status,risk_level,affected_systems_json,
            affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
            source_branch,policy_commit_sha,implementer_type,implementer_principal_id,
            created_at,updated_at)
           VALUES ('change-self-audit','Title','Summary','','proposed','low',
                   '["DUSS"]','[]','rollback','human','human-1',
                   'feature/test','policy-sha','ai','agent-same',1,1)"""
    )
    check(
        "human implementer requires human user identity",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,rationale,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
                source_branch,policy_commit_sha,implementer_type,implementer_principal_id,
                created_at,updated_at)
               VALUES ('change-bad-human-implementer','Title','Summary','','proposed','low',
                       '[]','[]','rollback','human','human-1',
                       'feature/test','policy-sha','human','agent-x',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "AI implementer requires AI principal identity",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,rationale,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
                source_branch,policy_commit_sha,implementer_type,implementer_user_id,
                created_at,updated_at)
               VALUES ('change-bad-ai-implementer','Title','Summary','','proposed','low',
                       '[]','[]','rollback','human','human-1',
                       'feature/test','policy-sha','ai','human-2',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "human reviewer cannot submit independent AI audit",
        lambda: db.execute(
            """INSERT INTO duga_reviews
               (id,change_request_id,review_type,reviewer_type,reviewer_user_id,
                decision,reviewed_commit_sha,evidence_json,created_at)
               VALUES ('review-human-as-ai','change-self-audit','independent_ai_audit','human',
                       'human-2','approved','commit-1','{}',2)"""
        ),
        should_fail=True,
    )
    check(
        "AI reviewer cannot submit human review",
        lambda: db.execute(
            """INSERT INTO duga_reviews
               (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                decision,reviewed_commit_sha,evidence_json,created_at)
               VALUES ('review-ai-as-human','change-self-audit','human_review','ai',
                       'agent-independent','approved','commit-1','{}',2)"""
        ),
        should_fail=True,
    )

    check(
        "AI implementer cannot independently audit own change",
        lambda: db.execute(
            """INSERT INTO duga_reviews
               (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                decision,reviewed_commit_sha,evidence_json,created_at)
               VALUES ('review-self','change-self-audit','independent_ai_audit','ai',
                       'agent-same','approved','commit-1','{}',2)"""
        ),
        should_fail=True,
    )
    check(
        "independent AI auditor may review change",
        lambda: db.execute(
            """INSERT INTO duga_reviews
               (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                decision,reviewed_commit_sha,evidence_json,created_at)
               VALUES ('review-independent','change-self-audit','independent_ai_audit','ai',
                       'agent-independent','approved','commit-1','{}',2)"""
        ),
        should_fail=False,
    )

    check(
        "review evidence cannot be updated",
        lambda: db.execute(
            "UPDATE duga_reviews SET reviewer_principal_id='agent-same' WHERE id='review-independent'"
        ),
        should_fail=True,
    )
    check(
        "review evidence cannot be deleted",
        lambda: db.execute(
            "DELETE FROM duga_reviews WHERE id='review-independent'"
        ),
        should_fail=True,
    )

    check(
        "finding review metadata must be paired",
        lambda: db.execute(
            """INSERT INTO duga_analysis_findings
               (id,analyzer_version,repository_commit_sha,file_path,classification,
                confidence,evidence_json,status,created_at,reviewed_at)
               VALUES ('finding-unpaired','1','abc','src/a.js','A',0.9,'[]','open',1,2)"""
        ),
        should_fail=True,
    )
    check(
        "queued job cannot retain a lease",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,lease_expires_at,created_at,updated_at)
               VALUES ('job-queued-lease','validation','queued','{}',1,99,1,1)"""
        ),
        should_fail=True,
    )
    check(
        "running job requires a lease",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,created_at,updated_at)
               VALUES ('job-running-no-lease','validation','running','{}',1,1,1)"""
        ),
        should_fail=True,
    )
    check(
        "running job with lease accepted",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,lease_expires_at,created_at,updated_at)
               VALUES ('job-running-lease','validation','running','{}',1,99,1,1)"""
        ),
        should_fail=False,
    )

    check(
        "affected systems must be a JSON array",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,rationale,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
                source_branch,policy_commit_sha,created_at,updated_at)
               VALUES ('change-scalar-json','Title','Summary','','proposed','low',
                       '"DUSS"','[]','rollback','human','human-1',
                       'feature/test','policy-sha',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "AI request principal cannot be empty",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,rationale,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,requested_by_principal_id,
                source_branch,policy_commit_sha,created_at,updated_at)
               VALUES ('change-empty-ai','Title','Summary','','proposed','low',
                       '[]','[]','rollback','ai','',
                       'feature/test','policy-sha',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "AI implementer principal cannot be empty",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,rationale,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
                source_branch,policy_commit_sha,implementer_type,implementer_principal_id,
                created_at,updated_at)
               VALUES ('change-empty-implementer','Title','Summary','','proposed','low',
                       '[]','[]','rollback','human','human-1',
                       'feature/test','policy-sha','ai','',1,1)"""
        ),
        should_fail=True,
    )

    check(
        "AI audit actor principal cannot be empty",
        lambda: db.execute(
            """INSERT INTO duga_audit_events
               (id,aggregate_type,aggregate_id,event_type,actor_type,
                actor_principal_id,payload_json,created_at)
               VALUES ('event-empty-ai','platform','platform','test','ai','','{}',1)"""
        ),
        should_fail=True,
    )

    check(
        "system audit actor ID cannot be empty",
        lambda: db.execute(
            """INSERT INTO duga_audit_events
               (id,aggregate_type,aggregate_id,event_type,actor_type,
                actor_system_id,payload_json,created_at)
               VALUES ('event-empty-system','platform','platform','test','system','','{}',1)"""
        ),
        should_fail=True,
    )

    check(
        "AI reviewer principal cannot be empty",
        lambda: db.execute(
            """INSERT INTO duga_reviews
               (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                decision,reviewed_commit_sha,evidence_json,created_at)
               VALUES ('review-empty-principal','change-self-audit','independent_ai_audit','ai',
                       '','approved','commit-1','{}',2)"""
        ),
        should_fail=True,
    )

    check(
        "duplicate active platform-owner blocked",
        lambda: insert_assignment(
            "assignment-second-owner", "platform", None,
            "platform-owner", "human", user_id="human-2"
        ),
        should_fail=True,
    )

    db.execute(
        """INSERT INTO duga_audit_events
           (id,aggregate_type,aggregate_id,event_type,actor_type,
            actor_user_id,payload_json,created_at)
           VALUES ('event-1','platform','platform','test','human','human-1','{}',1)"""
    )
    check(
        "audit event UPDATE blocked",
        lambda: db.execute(
            "UPDATE duga_audit_events SET event_type='tampered' WHERE id='event-1'"
        ),
        should_fail=True,
    )
    check(
        "audit event DELETE blocked",
        lambda: db.execute(
            "DELETE FROM duga_audit_events WHERE id='event-1'"
        ),
        should_fail=True,
    )
    check(
        "referenced human key update restricted",
        lambda: db.execute(
            "UPDATE users SET id='human-1-renamed' WHERE id='human-1'"
        ),
        should_fail=True,
    )
    check(
        "referenced human deletion restricted",
        lambda: db.execute("DELETE FROM users WHERE id='human-1'"),
        should_fail=True,
    )
    check(
        "malformed JSON rejected",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,created_at,updated_at)
               VALUES ('job-bad-json','static_analysis','queued','not-json',1,1,1)"""
        ),
        should_fail=True,
    )

    table_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'duga_%'"
    ).fetchone()[0]
    index_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE '%duga_%' AND name NOT LIKE 'sqlite_autoindex_%'"
    ).fetchone()[0]
    trigger_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'duga_%'"
    ).fetchone()[0]

    if (table_count, trigger_count) != (8, 5):
        raise AssertionError(
            f"Unexpected schema object counts: tables={table_count}, triggers={trigger_count}"
        )

    print("DUGA schema local SQLite smoke test: PASS")
    print(f"Tables: {table_count}; DUGA indexes: {index_count}; triggers: {trigger_count}")
    for name in passed:
        print(f"PASS: {name}")
    print("LIMITATION: in-memory SQLite only; this does not test Cloudflare D1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
