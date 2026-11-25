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

    check(
        "valid active system-owner",
        lambda: insert_assignment(
            "assignment-system-owner", "system", "DUSS",
            "system-owner", "human", user_id="human-1"
        ),
        should_fail=False,
    )
    check(
        "second active system-owner for same system blocked",
        lambda: insert_assignment(
            "assignment-second-system-owner", "system", "DUSS",
            "system-owner", "human", user_id="human-2"
        ),
        should_fail=True,
    )
    db.execute(
        "UPDATE duga_assignments SET status='revoked', revoked_at=2 "
        "WHERE id='assignment-system-owner'"
    )
    check(
        "revoked system-owner permits replacement",
        lambda: insert_assignment(
            "assignment-replacement-system-owner", "system", "DUSS",
            "system-owner", "human", user_id="human-2"
        ),
        should_fail=False,
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
        "assignment cannot reference an unknown human",
        lambda: insert_assignment(
            "assignment-unknown-human", "platform", None,
            "governance-manager", "human", user_id="missing-user"
        ),
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

    check(
        "affected systems must be a JSON array",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,
                requested_by_user_id,source_branch,policy_commit_sha,
                created_at,updated_at)
               VALUES ('change-systems-object','Valid title','Valid summary',
                       'proposed','medium','{}','[]','revert','human',
                       'human-1','feature/test','policy-sha',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "affected paths must be a JSON array",
        lambda: db.execute(
            """INSERT INTO duga_change_requests
               (id,title,summary,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,
                requested_by_user_id,source_branch,policy_commit_sha,
                created_at,updated_at)
               VALUES ('change-paths-object','Valid title','Valid summary',
                       'proposed','medium','[]','{}','revert','human',
                       'human-1','feature/test','policy-sha',1,1)"""
        ),
        should_fail=True,
    )
    check(
        "job input must be a JSON object",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,created_at,updated_at)
               VALUES ('job-input-array','static_analysis','queued','[]',1,1,1)"""
        ),
        should_fail=True,
    )
    check(
        "job result must be a JSON object",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,result_json,available_at,
                created_at,updated_at)
               VALUES ('job-result-array','static_analysis','failed','{}','[]',1,1,1)"""
        ),
        should_fail=True,
    )

    check(
        "finding evidence must be a JSON object",
        lambda: db.execute(
            """INSERT INTO duga_analysis_findings
               (id,analyzer_version,repository_commit_sha,file_path,
                classification,confidence,evidence_json,created_at)
               VALUES ('finding-array','test','commit-a','src/app.js',
                       'A',0.5,'[]',1)"""
        ),
        should_fail=True,
    )
    check(
        "malformed finding evidence is rejected cleanly",
        lambda: db.execute(
            """INSERT INTO duga_analysis_findings
               (id,analyzer_version,repository_commit_sha,file_path,
                classification,confidence,evidence_json,created_at)
               VALUES ('finding-bad-json','test','commit-a','src/app.js',
                       'A',0.5,'{',1)"""
        ),
        should_fail=True,
    )
    check(
        "audit payload must be a JSON object",
        lambda: db.execute(
            """INSERT INTO duga_audit_events
               (id,aggregate_type,aggregate_id,event_type,actor_type,
                actor_user_id,payload_json,created_at)
               VALUES ('event-array','platform','platform','test','human',
                       'human-1','[]',1)"""
        ),
        should_fail=True,
    )
    check(
        "malformed JSON remains a clean constraint rejection",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,created_at,updated_at)
               VALUES ('job-bad-json-again','static_analysis','queued','{',1,1,1)"""
        ),
        should_fail=True,
    )

    def insert_change(change_id: str, *, status: str = "proposed",
                      parent_id: str | None = None,
                      risk: str = "medium", requester_type: str = "human",
                      requester_user: str | None = "human-1",
                      requester_principal: str | None = None,
                      branch: str = "feature/schema-test") -> None:
        db.execute(
            """INSERT INTO duga_change_requests
               (id,parent_change_request_id,title,summary,status,risk_level,affected_systems_json,
                affected_paths_json,rollback_plan,requested_by_type,
                requested_by_user_id,requested_by_principal_id,source_branch,
                policy_commit_sha,state_version,created_at,updated_at)
               VALUES (?,?,?,?,?,?,'["DUSS"]','["src/test.js"]','revert commit',?,?,?,?,?,1,1,1)""",
            (change_id, parent_id, "Test change", "Lifecycle test", status, risk,
             requester_type, requester_user, requester_principal, branch, "policy-sha"),
        )

    check("valid human change request", lambda: insert_change("change-1"),
          should_fail=False)
    check("SQL accepts a referentially valid predecessor link (terminal-state validation is API-owned)",
          lambda: insert_change("change-followup", parent_id="change-1"),
          should_fail=False)
    check("linked request cannot reference a missing predecessor",
          lambda: insert_change("change-orphan-followup", parent_id="missing-parent"),
          should_fail=True)
    check("linked request cannot reference itself",
          lambda: insert_change("change-self-parent", parent_id="change-self-parent"),
          should_fail=True)
    check("linked request parent is immutable",
          lambda: db.execute("UPDATE duga_change_requests SET parent_change_request_id='change-followup' WHERE id='change-1'"),
          should_fail=True)
    check("known terminal state is accepted by the SQL enum",
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

    check("whitespace-only rollback plan rejected",
          lambda: db.execute(
              """INSERT INTO duga_change_requests
                 (id,title,summary,status,risk_level,affected_systems_json,
                  affected_paths_json,rollback_plan,requested_by_type,
                  requested_by_user_id,source_branch,policy_commit_sha,
                  created_at,updated_at)
                 VALUES ('change-blank-rollback','Valid title','Valid summary',
                         'proposed','medium','[]','[]','   ','human',
                         'human-1','feature/test','policy-sha',1,1)"""
          ), should_fail=True)
    check("blank AI requester principal rejected",
          lambda: insert_change("change-blank-principal", requester_type="ai",
                                requester_user=None, requester_principal="   "),
          should_fail=True)

    db.execute(
        """INSERT INTO duga_reviews
           (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
            decision,reviewed_commit_sha,evidence_json,created_at)
           VALUES ('review-ai','change-1','independent_ai_audit','ai','auditor-x',
                   'approved','commit-a','{}',2)"""
    )
    check("AI audit cannot make a terminal rejection decision",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-ai-reject','change-1','independent_ai_audit','ai','auditor-x',
                         'rejected','commit-a','{}',2)"""
          ), should_fail=True)
    check("AI audit may request changes without terminal rejection",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-ai-changes','change-1','independent_ai_audit','ai','auditor-x',
                         'changes_requested','commit-a','{}',2)"""
          ), should_fail=False)
    check("authorized human review may record terminal rejection",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_user_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-human-reject','change-1','human_review','human','human-2',
                         'rejected','commit-a','{}',2)"""
          ), should_fail=False)

    check("AI principal cannot submit human review",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-bad','change-1','human_review','ai','agent-x',
                         'approved','commit-a','{}',2)"""
          ), should_fail=True)

    check("review must reference an existing change request",
          lambda: db.execute(
              """INSERT INTO duga_reviews
                 (id,change_request_id,review_type,reviewer_type,reviewer_principal_id,
                  decision,reviewed_commit_sha,evidence_json,created_at)
                 VALUES ('review-orphan','missing-change','independent_ai_audit','ai',
                         'auditor-x','approved','commit-a','{}',2)"""
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

    check("approval must reference an existing change request",
          lambda: db.execute(
              """INSERT INTO duga_approvals
                 (id,change_request_id,approver_user_id,approver_role,decision,
                  approved_commit_sha,created_at)
                 VALUES ('approval-orphan','missing-change','human-1','platform-owner',
                         'approved','commit-a',3)"""
          ), should_fail=True)
    check("unknown validation status rejected",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,created_at)
                 VALUES ('validation-bad','change-1','commit-a','green','ci','{}',4)"""
          ), should_fail=True)

    check("validation run must reference an existing change request",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,created_at)
                 VALUES ('validation-orphan','missing-change','commit-a','queued','ci','{}',4)"""
          ), should_fail=True)
    check("malformed validation evidence rejected",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,created_at)
                 VALUES ('validation-json-bad','change-1','commit-a','passed','ci','[]oops',4)"""
          ), should_fail=True)

    check("queued validation cannot have a start timestamp",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,
                  started_at,created_at)
                 VALUES ('validation-queued-start','change-1','commit-a','queued',
                         'ci','{}',5,4)"""
          ), should_fail=True)
    check("completed validation requires ordered timestamps",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,
                  started_at,completed_at,created_at)
                 VALUES ('validation-time-order','change-1','commit-a','passed',
                         'ci','{}',8,7,4)"""
          ), should_fail=True)
    check("valid running validation requires start and no completion",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,
                  started_at,created_at)
                 VALUES ('validation-running','change-1','commit-a','running',
                         'ci','{}',5,4)"""
          ), should_fail=False)
    check("successful validation requires completion timestamp",
          lambda: db.execute(
              """INSERT INTO duga_validation_runs
                 (id,change_request_id,commit_sha,status,validator,results_json,
                  started_at,created_at)
                 VALUES ('validation-passed-no-end','change-1','commit-a','passed',
                         'ci','{}',5,4)"""
          ), should_fail=True)

    check("running job requires lease expiry",
          lambda: db.execute(
              """INSERT INTO duga_jobs
                 (id,job_type,status,input_json,available_at,created_at,updated_at)
                 VALUES ('job-running-no-lease','validation','running','{}',1,1,1)"""
          ), should_fail=True)
    check("queued job cannot retain a lease",
          lambda: db.execute(
              """INSERT INTO duga_jobs
                 (id,job_type,status,input_json,available_at,lease_expires_at,
                  created_at,updated_at)
                 VALUES ('job-queued-lease','validation','queued','{}',1,9,1,1)"""
          ), should_fail=True)
    check("succeeded job requires result payload",
          lambda: db.execute(
              """INSERT INTO duga_jobs
                 (id,job_type,status,input_json,available_at,created_at,updated_at)
                 VALUES ('job-success-no-result','validation','succeeded','{}',1,1,1)"""
          ), should_fail=True)
    check("valid running job accepts lease",
          lambda: db.execute(
              """INSERT INTO duga_jobs
                 (id,job_type,status,input_json,available_at,lease_expires_at,
                  created_at,updated_at)
                 VALUES ('job-running-valid','validation','running','{}',1,99,1,1)"""
          ), should_fail=False)

    check("assignment revocation cannot predate assignment",
          lambda: db.execute(
              """INSERT INTO duga_assignments
                 (id,scope_type,role_id,subject_type,user_id,status,
                  created_at,revoked_at)
                 VALUES ('assignment-time-invalid','platform','governance-manager',
                         'human','human-2','revoked',10,9)"""
          ), should_fail=True)

    # CAS + conditional audit prototype. A unique transition token is stored on the
    # request only when the expected state/version matches and the token is unused.
    # The audit INSERT ... SELECT succeeds only for that exact token/version.
    insert_change("change-concurrency")

    def run_transition(change_id: str, expected_version: int, expected_status: str,
                       next_status: str, token: str, event_id: str,
                       *, invalid_actor: bool = False) -> tuple[int, int]:
        db.commit()
        db.execute("BEGIN")
        try:
            update = db.execute(
                """UPDATE duga_change_requests
                   SET status=?, state_version=state_version+1,
                       last_transition_id=?, updated_at=updated_at+1
                   WHERE id=? AND state_version=? AND status=?
                     AND NOT EXISTS (
                       SELECT 1 FROM duga_audit_events WHERE transition_id=?
                     )""",
                (next_status, token, change_id, expected_version,
                 expected_status, token),
            )
            actor_type = "human"
            actor_user_id = None if invalid_actor else "human-1"
            audit = db.execute(
                """INSERT INTO duga_audit_events
                   (id,aggregate_type,aggregate_id,event_type,actor_type,
                    actor_user_id,payload_json,transition_id,created_at)
                   SELECT ?, 'change_request', id, 'state_transition', ?,
                          ?, '{}', ?, updated_at
                   FROM duga_change_requests
                   WHERE id=? AND state_version=? AND last_transition_id=?
                     AND NOT EXISTS (
                       SELECT 1 FROM duga_audit_events WHERE transition_id=?
                     )""",
                (event_id, actor_type, actor_user_id, token, change_id,
                 expected_version + 1, token, token),
            )
            db.commit()
            return update.rowcount, audit.rowcount
        except sqlite3.IntegrityError:
            db.rollback()
            raise

    changed, audited = run_transition(
        "change-concurrency", 1, "proposed", "analyzing",
        "transition-token-1", "event-transition-1"
    )
    if (changed, audited) != (1, 1):
        raise AssertionError(f"successful transition should update+audit once: {(changed, audited)}")
    passed.append("CAS transition creates exactly one audit event for its unique token")

    changed, audited = run_transition(
        "change-concurrency", 1, "proposed", "impact_review",
        "transition-token-stale", "event-transition-stale"
    )
    if (changed, audited) != (0, 0):
        raise AssertionError(f"stale writer must update zero rows and create no audit: {(changed, audited)}")
    passed.append("stale writer updates zero rows and creates no audit event")

    changed, audited = run_transition(
        "change-concurrency", 1, "proposed", "impact_review",
        "transition-token-1", "event-transition-replay"
    )
    if (changed, audited) != (0, 0):
        raise AssertionError(f"replayed transition token must be rejected: {(changed, audited)}")
    passed.append("replayed transition token cannot update state or duplicate audit")

    changed, audited = run_transition(
        "change-concurrency", 2, "analyzing", "impact_review",
        "transition-token-1", "event-transition-token-reuse"
    )
    if (changed, audited) != (0, 0):
        raise AssertionError(f"reused token on a later state must be rejected: {(changed, audited)}")
    passed.append("previously used transition token cannot be reused for another state change")

    # If the audit INSERT fails, the surrounding transaction must roll back the CAS update.
    try:
        run_transition(
            "change-concurrency", 2, "analyzing", "impact_review",
            "transition-token-invalid-audit", "event-invalid-actor",
            invalid_actor=True
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("invalid audit actor should abort the transition transaction")
    rollback_state = db.execute(
        "SELECT status,state_version,last_transition_id FROM duga_change_requests WHERE id='change-concurrency'"
    ).fetchone()
    if rollback_state != ("analyzing", 2, "transition-token-1"):
        raise AssertionError(f"state update was not rolled back with failed audit: {rollback_state}")
    passed.append("failed audit insert rolls back CAS update and preserves prior transition token")

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

    if (table_count, trigger_count) != (8, 3):
        raise AssertionError(
            f"Unexpected schema object counts: tables={table_count}, triggers={trigger_count}"
        )

    foreign_key_errors = db.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_key_errors:
        raise AssertionError(f"Foreign key violations after valid fixtures: {foreign_key_errors}")
    passed.append("foreign_key_check reports no violations after valid fixtures")

    print("DUGA schema local SQLite smoke test: PASS")
    print(f"Tables: {table_count}; DUGA indexes: {index_count}; triggers: {trigger_count}")
    for name in passed:
        print(f"PASS: {name}")
    print("LIMITATION: in-memory SQLite only; this does not test Cloudflare D1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
