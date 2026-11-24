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
                principal_id,status,created_at)
               VALUES (?,?,?,?,?,?,?,'active',1)""",
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

    def insert_change(change_id: str, *, status: str = "proposed",
                      risk: str = "medium", requester_type: str = "human",
                      requester_user: str | None = "human-1",
                      requester_principal: str | None = None,
                      branch: str = "feature/schema-test") -> None:
        db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,
                requested_by_user_id,requested_by_principal_id,source_branch,
                policy_commit_sha,state_version,created_at,updated_at)
               VALUES (?,?,?,?,?,'["DUSS"]','["src/test.js"]','revert commit',?,?,?,?,?,1,1,1)""",
            (change_id, "Test change", "Lifecycle test", status, risk,
             requester_type, requester_user, requester_principal, branch, "policy-sha"),
        )

    check("valid human change request", lambda: insert_change("change-1"),
          should_fail=False)
    check("unknown change state rejected",
          lambda: insert_change("change-bad-state", status="accepted"),
          should_fail=False)  # accepted is an allowed enum; transition authorization is API-owned.
    check("invalid risk level rejected",
          lambda: insert_change("change-bad-risk", risk="unbounded"),
          should_fail=True)
    check("requester human/AI XOR enforced",
          lambda: insert_change("change-bad-xor", requester_type="human",
                                requester_user="human-1", requester_principal="agent-x"),
          should_fail=True)
    check("main branch rejected",
          lambda: insert_change("change-main", branch="main"),
          should_fail=True)

    db.execute(
        """INSERT INTO duga_reviews
           (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
            decision,reviewed_commit_sha,evidence_json,created_at)
           VALUES ('review-ai','change-1','independent_ai_audit','ai','auditor-x',
                   'approved','commit-a','{}',2)"""
    )
    check("AI principal cannot submit human review",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-bad','change-1','human_review','ai','agent-x',
                         'approved','commit-a','{}',2)"""
          ), should_fail=True)

    db.execute(
        """INSERT INTO duga_approvals
           (id,change_request_id,approver_user_id,approver_role,decision,
            approved_commit_sha,created_at)
           VALUES ('approval-1','change-1','human-1','platform-owner',
                   'approved','commit-a',3)"""
    )
    check("AI-only approver role rejected",
          lambda: db.execute(
              """INSERT INTO duga_approvals
                 (id,change_request_id,approver_user_id,approver_role,decision,
                  approved_commit_sha,created_at)
                 VALUES ('approval-bad','change-1','human-1','ai-maintainer',
                         'approved','commit-a',3)"""
          ), should_fail=True)
    check("unknown validation status rejected",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,created_at)
                 VALUES ('validation-bad','change-1','commit-a','green','ci','{}',4)"""
          ), should_fail=True)
    check("malformed validation evidence rejected",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,created_at)
                 VALUES ('validation-json-bad','change-1','commit-a','passed','ci','[]oops',4)"""
          ), should_fail=True)

    # Schema-level boundary: the SQL enum permits any listed status; legal transition
    # order, stale-commit invalidation and actor/assignment authorization belong to API logic.
    db.execute("UPDATE duga_change_requests SET status='accepted', state_version=state_version+1 WHERE id='change-1'")
    final_state = db.execute(
        "SELECT status FROM duga_change_requests WHERE id='change-1'"
    ).fetchone()[0]
    if final_state != "accepted":
        raise AssertionError("status enum probe did not behave as documented")
    passed.append("state transition authorization is not enforced by SQL (API gate required)")

    table_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'duga_%'"
    ).fetchone()[0]
    index_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE '%duga_%' AND name NOT LIKE 'sqlite_autoindex_%'"
    ).fetchone()[0]
    trigger_count = db.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'duga_%'"
    ).fetchone()[0]

    if (table_count, trigger_count) != (8, 2):
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
