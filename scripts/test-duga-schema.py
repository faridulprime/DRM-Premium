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

    def require_audit_event(event_id: str) -> None:
        if db.execute(
            "SELECT 1 FROM duga_audit_events WHERE id=?", (event_id,)
        ).fetchone() is None:
            raise AssertionError(f"missing generated audit event: {event_id}")

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
            source_branch,policy_commit_sha,created_at,updated_at)
           VALUES ('change-self-audit','Title','Summary','','proposed','low',
                   '["DUSS"]','[]','rollback','human','human-1',
                   'feature/test','policy-sha',1,1)"""
    )
    # Change-request lifecycle: insert invariants, allow-list, versioning and audit.
    check("change request must start in proposed",
          lambda: db.execute("""INSERT INTO duga_change_requests
            (id,title,summary,rationale,status,risk_level,affected_systems_json,
             affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
             source_branch,policy_commit_sha,created_at,updated_at)
            VALUES ('change-forged-approved','Title','Summary','','approved','low',
                    '[]','[]','rollback','human','human-1','feature/test','policy-sha',1,1)"""),
          should_fail=True)
    check("change request initial version must be one",
          lambda: db.execute("""INSERT INTO duga_change_requests
            (id,title,summary,rationale,status,risk_level,affected_systems_json,
             affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
             source_branch,policy_commit_sha,state_version,created_at,updated_at)
            VALUES ('change-forged-version','Title','Summary','','proposed','low',
                    '[]','[]','rollback','human','human-1','feature/test','policy-sha',2,1,1)"""),
          should_fail=True)
    check("change request cannot begin with implementer assigned",
          lambda: db.execute("""INSERT INTO duga_change_requests
            (id,title,summary,rationale,status,risk_level,affected_systems_json,
             affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
             source_branch,policy_commit_sha,implementer_type,implementer_principal_id,
             created_at,updated_at)
            VALUES ('change-forged-implementer','Title','Summary','','proposed','low',
                    '[]','[]','rollback','human','human-1','feature/test','policy-sha',
                    'ai','agent-x',1,1)"""),
          should_fail=True)
    check("change request creation/update timestamps must match",
          lambda: db.execute("""INSERT INTO duga_change_requests
            (id,title,summary,rationale,status,risk_level,affected_systems_json,
             affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
             source_branch,policy_commit_sha,created_at,updated_at)
            VALUES ('change-bad-created-at','Title','Summary','','proposed','low',
                    '[]','[]','rollback','human','human-1','feature/test','policy-sha',1,2)"""),
          should_fail=True)

    def transition_request(request_id, old_status, new_status, old_version,
                           timestamp, extra_sql="", extra_params=()):
        db.execute(
            f"UPDATE duga_change_requests SET status=?,state_version=?,updated_at=? {extra_sql} "
            "WHERE id=? AND status=? AND state_version=?",
            (new_status, old_version + 1, timestamp, *extra_params,
             request_id, old_status, old_version),
        )

    # Move the self-audit fixture through the permitted gates; assign its
    # implementer only when the approved request enters implementation.
    transition_request("change-self-audit","proposed","analyzing",1,2)
    transition_request("change-self-audit","analyzing","impact_review",2,3)
    transition_request("change-self-audit","impact_review","awaiting_ai_audit",3,4)
    transition_request("change-self-audit","awaiting_ai_audit","awaiting_human_approval",4,5)
    transition_request("change-self-audit","awaiting_human_approval","approved",5,6)
    transition_request("change-self-audit","approved","implementing",6,7,
                       ",implementer_type='ai',implementer_principal_id='agent-same'")
    check("change-request transitions create database audit events",
          lambda: require_audit_event("change-request-transition:change-self-audit:7"),
          should_fail=False)
    check("change-request audit identifies itself as database trigger, not human",
          lambda: db.execute("""SELECT 1 FROM duga_audit_events
            WHERE id='change-request-transition:change-self-audit:7'
              AND actor_type='system' AND actor_system_id='duga-db-trigger'""").fetchone()
            or (_ for _ in ()).throw(AssertionError("synthetic actor attribution missing")),
          should_fail=False)
    check("illegal state skip rejected",
          lambda: db.execute("""UPDATE duga_change_requests
            SET status='accepted',state_version=8,updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("status change without version increment rejected",
          lambda: db.execute("""UPDATE duga_change_requests
            SET status='validating',updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("non-status update cannot increment state version",
          lambda: db.execute("""UPDATE duga_change_requests
            SET rationale='changed',state_version=8,updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("requester identity is immutable",
          lambda: db.execute("""UPDATE duga_change_requests
            SET requested_by_user_id='human-2',updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("policy binding is immutable",
          lambda: db.execute("""UPDATE duga_change_requests
            SET policy_commit_sha='new-policy',updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("implementation commit cannot be overwritten",
          lambda: db.execute("""UPDATE duga_change_requests
            SET implementation_commit_sha='forged-commit',updated_at=8
            WHERE id='change-self-audit'"""),
          should_fail=True)
    check("change request cannot be physically deleted",
          lambda: db.execute("DELETE FROM duga_change_requests WHERE id='change-self-audit'"),
          should_fail=True)

    db.execute("""INSERT INTO duga_change_requests
       (id,title,summary,rationale,status,risk_level,affected_systems_json,
        affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
        source_branch,policy_commit_sha,created_at,updated_at)
       VALUES ('change-blocked','Title','Summary','','proposed','low','[]','[]',
               'rollback','human','human-1','feature/test','policy-sha',1,1)""")
    check("block requires recorded prior state and stable reason",
          lambda: db.execute("""UPDATE duga_change_requests SET status='blocked',
            state_version=2,updated_at=2 WHERE id='change-blocked'"""),
          should_fail=True)
    check("block transition records prior state and reason",
          lambda: db.execute("""UPDATE duga_change_requests SET status='blocked',
            blocked_from_status='proposed',block_reason_code='security_review',
            state_version=2,updated_at=2 WHERE id='change-blocked'
              AND status='proposed' AND state_version=1"""),
          should_fail=False)
    check("blocked request cannot resume directly to implementation",
          lambda: db.execute("""UPDATE duga_change_requests SET status='implementing',
            blocked_from_status=NULL,block_reason_code=NULL,state_version=3,updated_at=3
            WHERE id='change-blocked'"""),
          should_fail=True)
    check("blocked request resumes through impact review only",
          lambda: db.execute("""UPDATE duga_change_requests SET status='impact_review',
            blocked_from_status=NULL,block_reason_code=NULL,state_version=3,updated_at=3
            WHERE id='change-blocked' AND status='blocked' AND state_version=2"""),
          should_fail=False)
    check("block and resume both generate audit events",
          lambda: (require_audit_event("change-request-transition:change-blocked:2"),
                   require_audit_event("change-request-transition:change-blocked:3")),
          should_fail=False)

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

    # Validation-run lifecycle: queued, running and terminal states.
    def insert_validation(run_id, status, started, completed):
        db.execute(
            """INSERT INTO duga_validation_runs
               (id,change_request_id,commit_sha,status,validator,results_json,
                started_at,completed_at,created_at)
               VALUES (?, 'change-self-audit','commit-1','queued','ci','{}',NULL,NULL,10)""",
            (run_id,),
        )
        if status == "queued":
            if started is not None or completed is not None:
                db.execute(
                    "UPDATE duga_validation_runs SET started_at=?,completed_at=? WHERE id=?",
                    (started, completed, run_id),
                )
            return
        if status == "running":
            db.execute(
                "UPDATE duga_validation_runs SET status='running',started_at=? WHERE id=?",
                (started, run_id),
            )
            return
        if status == "cancelled" and started is None:
            db.execute(
                "UPDATE duga_validation_runs SET status='cancelled',completed_at=? WHERE id=?",
                (completed, run_id),
            )
            return
        db.execute(
            "UPDATE duga_validation_runs SET status='running',started_at=? WHERE id=?",
            (started, run_id),
        )
        db.execute(
            "UPDATE duga_validation_runs SET status=?,completed_at=? WHERE id=?",
            (status, completed, run_id),
        )

    check("queued validation has no execution timestamps",
          lambda: insert_validation("validation-queued","queued",None,None),
          should_fail=False)
    check("running validation has start but no completion",
          lambda: insert_validation("validation-running","running",11,None),
          should_fail=False)
    check("passed validation requires ordered timestamps",
          lambda: insert_validation("validation-passed","passed",11,12),
          should_fail=False)
    check("failed validation requires ordered timestamps",
          lambda: insert_validation("validation-failed","failed",11,12),
          should_fail=False)
    check("cancelled queued validation records completion",
          lambda: insert_validation("validation-cancelled-queued","cancelled",None,12),
          should_fail=False)
    check("cancelled running validation records ordered completion",
          lambda: insert_validation("validation-cancelled-running","cancelled",11,12),
          should_fail=False)
    check("queued validation cannot have a start time",
          lambda: insert_validation("validation-bad-queued","queued",11,None),
          should_fail=True)
    check("running validation requires a start time",
          lambda: insert_validation("validation-bad-running","running",None,None),
          should_fail=True)
    check("passed validation requires completion",
          lambda: insert_validation("validation-bad-passed","passed",11,None),
          should_fail=True)
    check("failed validation cannot complete before start",
          lambda: insert_validation("validation-bad-failed","failed",12,11),
          should_fail=True)
    check("cancelled validation requires completion",
          lambda: insert_validation("validation-bad-cancelled","cancelled",11,None),
          should_fail=True)
    check("validation cannot be inserted already terminal",
          lambda: db.execute("""INSERT INTO duga_validation_runs
            (id,change_request_id,commit_sha,status,validator,results_json,
             started_at,completed_at,created_at)
            VALUES ('validation-forged-pass','change-self-audit','commit-1',
                    'passed','ci','{}',11,12,10)"""), should_fail=True)
    check("validation evidence cannot be deleted",
          lambda: db.execute("DELETE FROM duga_validation_runs WHERE id='validation-passed'"),
          should_fail=True)
    check("queued validation can start and is audited",
          lambda: db.execute("""UPDATE duga_validation_runs SET status='running',started_at=11
            WHERE id='validation-queued' AND status='queued'"""), should_fail=False)
    check("running validation can finish and is audited",
          lambda: db.execute("""UPDATE duga_validation_runs SET status='passed',completed_at=12
            WHERE id='validation-queued' AND status='running'"""), should_fail=False)
    check("terminal validation evidence cannot be changed",
          lambda: db.execute("UPDATE duga_validation_runs SET results_json='{}' WHERE id='validation-queued'"),
          should_fail=True)
    check("validation transition audit records queued-to-running",
          lambda: require_audit_event("validation-transition:validation-queued:running"),
          should_fail=False)
    check("validation transition audit records terminal result",
          lambda: require_audit_event("validation-transition:validation-queued:passed"),
          should_fail=False)
    check("cancelled validation completion cannot precede start",
          lambda: insert_validation("validation-bad-cancel-order","cancelled",12,11),
          should_fail=True)

    insert_assignment(
        "assignment-system-owner", "system", "DUSS",
        "system-owner", "human", user_id="human-2"
    )
    check(
        "approval accepted with active matching system-owner assignment",
        lambda: db.execute(
            """INSERT INTO duga_approvals
               (id,change_request_id,approver_user_id,approver_role,
                authorization_assignment_id,authorization_scope_type,authorization_scope_id,
                policy_commit_sha,decision,approved_commit_sha,created_at)
               VALUES ('approval-valid','change-self-audit','human-2','system-owner',
                       'assignment-system-owner','system','DUSS','policy-sha',
                       'approved','commit-1',3)"""
        ),
        should_fail=False,
    )
    check(
        "approval rejects mismatched system scope",
        lambda: db.execute(
            """INSERT INTO duga_approvals
               (id,change_request_id,approver_user_id,approver_role,
                authorization_assignment_id,authorization_scope_type,authorization_scope_id,
                policy_commit_sha,decision,approved_commit_sha,created_at)
               VALUES ('approval-wrong-scope','change-self-audit','human-2','system-owner',
                       'assignment-system-owner','system','OTHER','policy-sha',
                       'approved','commit-1',4)"""
        ),
        should_fail=True,
    )
    check(
        "approval rejects mismatched approver identity",
        lambda: db.execute(
            """INSERT INTO duga_approvals
               (id,change_request_id,approver_user_id,approver_role,
                authorization_assignment_id,authorization_scope_type,authorization_scope_id,
                policy_commit_sha,decision,approved_commit_sha,created_at)
               VALUES ('approval-wrong-user','change-self-audit','human-1','system-owner',
                       'assignment-system-owner','system','DUSS','policy-sha',
                       'approved','commit-1',4)"""
        ),
        should_fail=True,
    )
    check(
        "approval rejects stale policy revision",
        lambda: db.execute(
            """INSERT INTO duga_approvals
               (id,change_request_id,approver_user_id,approver_role,
                authorization_assignment_id,authorization_scope_type,authorization_scope_id,
                policy_commit_sha,decision,approved_commit_sha,created_at)
               VALUES ('approval-stale-policy','change-self-audit','human-2','system-owner',
                       'assignment-system-owner','system','DUSS','old-policy',
                       'approved','commit-1',4)"""
        ),
        should_fail=True,
    )
    db.execute("UPDATE duga_assignments SET status='revoked',revoked_at=5,revoked_by_user_id='human-1' WHERE id='assignment-system-owner'")
    check("assignment grant automatically writes audit evidence",
          lambda: require_audit_event("assignment-grant:assignment-system-owner"),
          should_fail=False)
    check("assignment revocation automatically writes audit evidence",
          lambda: require_audit_event("assignment-revoke:assignment-system-owner"),
          should_fail=False)
    check("assignment cannot be silently edited after grant",
          lambda: db.execute("UPDATE duga_assignments SET role_id='platform-owner' WHERE id='assignment-human-owner'"),
          should_fail=True)
    check("assignment cannot be inserted already revoked",
          lambda: db.execute("""INSERT INTO duga_assignments
            (id,scope_type,role_id,subject_type,user_id,status,assigned_by_user_id,
             created_at,revoked_at,revoked_by_user_id)
            VALUES ('assignment-pre-revoked','platform','platform-owner','human',
                    'human-2','revoked','human-1',1,2,'human-1')"""),
          should_fail=True)
    check("assignment grant evidence cannot be deleted",
          lambda: db.execute("DELETE FROM duga_assignments WHERE id='assignment-human-owner'"),
          should_fail=True)
    check("assignment revocation requires revoker identity",
          lambda: db.execute("UPDATE duga_assignments SET status='revoked',revoked_at=6 WHERE id='assignment-ai-maintainer'"),
          should_fail=True)
    check(
        "approval rejects revoked assignment",
        lambda: db.execute(
            """INSERT INTO duga_approvals
               (id,change_request_id,approver_user_id,approver_role,
                authorization_assignment_id,authorization_scope_type,authorization_scope_id,
                policy_commit_sha,decision,approved_commit_sha,created_at)
               VALUES ('approval-revoked','change-self-audit','human-2','system-owner',
                       'assignment-system-owner','system','DUSS','policy-sha',
                       'approved','commit-1',6)"""
        ),
        should_fail=True,
    )
    check(
        "approval evidence cannot be updated",
        lambda: db.execute("UPDATE duga_approvals SET decision='rejected' WHERE id='approval-valid'"),
        should_fail=True,
    )
    check(
        "approval evidence cannot be deleted",
        lambda: db.execute("DELETE FROM duga_approvals WHERE id='approval-valid'"),
        should_fail=True,
    )

    db.execute("""INSERT INTO duga_analysis_findings
       (id,analyzer_version,repository_commit_sha,file_path,classification,
        confidence,evidence_json,status,created_at)
       VALUES ('finding-review','1','abc','src/a.js','A',0.9,'[]','open',1)""")
    check("finding cannot be inserted pre-reviewed",
          lambda: db.execute("""INSERT INTO duga_analysis_findings
            (id,analyzer_version,repository_commit_sha,file_path,classification,
             confidence,evidence_json,status,created_at,reviewed_at,reviewed_by_user_id)
            VALUES ('finding-forged','1','abc','src/b.js','A',0.9,'[]',
                    'accepted',1,2,'human-1')"""), should_fail=True)
    check("finding can enter review with version increment",
          lambda: db.execute("""UPDATE duga_analysis_findings SET status='under_review',
            reviewed_at=2,reviewed_by_user_id='human-1',state_version=2
            WHERE id='finding-review' AND status='open' AND state_version=1"""),
          should_fail=False)
    check("finding review transition is audited",
          lambda: require_audit_event("finding-review:finding-review:2"),
          should_fail=False)
    check("finding analyzer evidence cannot be altered during review",
          lambda: db.execute("UPDATE duga_analysis_findings SET evidence_json='{}' WHERE id='finding-review'"),
          should_fail=True)
    check("finding cannot skip review version",
          lambda: db.execute("""UPDATE duga_analysis_findings SET status='accepted',
            reviewed_at=3,reviewed_by_user_id='human-2',state_version=4
            WHERE id='finding-review'"""), should_fail=True)
    check("finding cannot be deleted after evidence creation",
          lambda: db.execute("DELETE FROM duga_analysis_findings WHERE id='finding-review'"),
          should_fail=True)
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
        "running job requires owner token and positive fencing generation",
        lambda: db.execute(
            """INSERT INTO duga_jobs
               (id,job_type,status,input_json,available_at,lease_expires_at,created_at,updated_at)
               VALUES ('job-running-no-owner','validation','running','{}',1,99,1,1)"""
        ),
        should_fail=True,
    )
    check("job cannot be inserted already running with a forged lease",
        lambda: db.execute("""INSERT INTO duga_jobs
          (id,job_type,status,input_json,available_at,attempts,lease_owner,
           lease_token,lease_generation,lease_expires_at,created_at,updated_at)
          VALUES ('job-insert-running','validation','running','{}',1,1,
                  'worker-forged','token-forged',1,100,1,1)"""),
        should_fail=True)
    db.execute(
        """INSERT INTO duga_jobs
           (id,job_type,status,input_json,available_at,created_at,updated_at)
           VALUES ('job-queued','validation','queued','{}',1,1,1)"""
    )
    check("queued job can be atomically claimed with generation one",
        lambda: db.execute("""UPDATE duga_jobs SET status='running',attempts=1,
          lease_owner='worker-a',lease_token='token-queued',lease_generation=1,
          lease_expires_at=100,updated_at=2
          WHERE id='job-queued' AND status='queued' AND available_at<=50"""),
        should_fail=False)
    db.execute(
        """INSERT INTO duga_jobs
           (id,job_type,status,input_json,available_at,created_at,updated_at)
           VALUES ('job-lease','validation','queued','{}',1,1,1)"""
    )
    db.execute("""UPDATE duga_jobs SET status='running',attempts=1,
      lease_owner='worker-a',lease_token='token-a',lease_generation=1,
      lease_expires_at=100,updated_at=2
      WHERE id='job-lease' AND status='queued' AND available_at<=50""")
    check("duplicate active lease token rejected",
        lambda: db.execute("""UPDATE duga_jobs SET lease_owner='worker-b',
          lease_token='token-queued',lease_generation=2,attempts=2,lease_expires_at=100
          WHERE id='job-lease' AND status='running'"""),
        should_fail=True)
    check("heartbeat cannot mutate immutable job input",
        lambda: db.execute("""UPDATE duga_jobs SET input_json='{"tampered":true}',
          lease_expires_at=120,updated_at=2 WHERE id='job-lease' AND status='running'
          AND lease_token='token-a' AND lease_generation=1"""), should_fail=True)
    check("heartbeat cannot publish a result before terminal completion",
        lambda: db.execute("""UPDATE duga_jobs SET result_json='{}',lease_expires_at=120,
          updated_at=2 WHERE id='job-lease' AND status='running'
          AND lease_token='token-a' AND lease_generation=1"""), should_fail=True)
    check("heartbeat cannot mutate immutable job input",
        lambda: db.execute("""UPDATE duga_jobs SET input_json='{"tampered":true}',
          lease_expires_at=120,updated_at=2 WHERE id='job-lease' AND status='running'
          AND lease_token='token-a' AND lease_generation=1"""), should_fail=True)
    check("heartbeat cannot publish a result before terminal completion",
        lambda: db.execute("""UPDATE duga_jobs SET result_json='{}',lease_expires_at=120,
          updated_at=2 WHERE id='job-lease' AND status='running'
          AND lease_token='token-a' AND lease_generation=1"""), should_fail=True)
    check("heartbeat preserves lease identity and generation",
        lambda: db.execute("""UPDATE duga_jobs SET lease_expires_at=120,updated_at=2
          WHERE id='job-lease' AND status='running' AND lease_token='token-a'
            AND lease_generation=1 AND lease_expires_at>50"""), should_fail=False)
    check("stale worker completion after expiry changes no row",
        lambda: db.execute("""UPDATE duga_jobs SET status='succeeded',result_json='{}',
          lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL
          WHERE id='job-lease' AND status='running' AND lease_token='token-a'
            AND lease_generation=1 AND lease_expires_at>200"""), should_fail=False)
    db.execute("""UPDATE duga_jobs SET lease_owner='worker-b',lease_token='token-b',
          lease_generation=2,attempts=2,lease_expires_at=300,updated_at=3
          WHERE id='job-lease' AND status='running' AND lease_token='token-a'
            AND lease_generation=1 AND lease_expires_at<=200""")
    check("old lease token cannot complete after reclaim",
        lambda: db.execute("""UPDATE duga_jobs SET status='succeeded',result_json='{}',
          lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL
          WHERE id='job-lease' AND status='running' AND lease_token='token-a'
            AND lease_generation=1"""), should_fail=False)
    check("old lease token cannot heartbeat after reclaim",
        lambda: db.execute("""UPDATE duga_jobs SET lease_expires_at=400
          WHERE id='job-lease' AND status='running' AND lease_token='token-a'
            AND lease_generation=1"""), should_fail=False)
    check("fencing generation cannot be skipped",
        lambda: db.execute("""UPDATE duga_jobs SET lease_generation=4,attempts=3,
          lease_token='token-c',lease_owner='worker-c',lease_expires_at=500
          WHERE id='job-lease'"""), should_fail=True)
    check("lease identity cannot change without fencing increment",
        lambda: db.execute("""UPDATE duga_jobs SET lease_token='token-c',lease_owner='worker-c'
          WHERE id='job-lease'"""), should_fail=True)
    check("current worker can complete and clear lease",
        lambda: db.execute("""UPDATE duga_jobs SET status='succeeded',result_json='{}',
          lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=4
          WHERE id='job-lease' AND status='running' AND lease_token='token-b'
            AND lease_generation=2 AND lease_expires_at>250"""), should_fail=False)

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

    if (table_count, trigger_count) != (8, 27):
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
