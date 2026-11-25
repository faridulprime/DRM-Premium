#!/usr/bin/env python3
"""Deep structural validation for the DUGA SQLite/D1 schema draft.

Runs only against an in-memory SQLite database. It does not connect to Cloudflare.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "governance" / "schemas" / "d1-operational-schema.sql"

EXPECTED_COLUMNS = {
    "duga_assignments": "id scope_type scope_id role_id subject_type user_id principal_id status assigned_by_user_id created_at revoked_at".split(),
    "duga_change_requests": "id title summary rationale status risk_level affected_systems_json affected_paths_json rollback_plan requested_by_type requested_by_user_id requested_by_principal_id source_branch base_commit_sha policy_commit_sha implementer_type implementer_user_id implementer_principal_id implementation_commit_sha state_version created_at updated_at".split(),
    "duga_reviews": "id change_request_id review_type reviewer_type reviewer_user_id reviewer_principal_id decision reviewed_commit_sha evidence_json created_at".split(),
    "duga_approvals": "id change_request_id approver_user_id approver_role decision approved_commit_sha rationale created_at".split(),
    "duga_validation_runs": "id change_request_id commit_sha status validator validator_version results_json started_at completed_at created_at".split(),
    "duga_audit_events": "id aggregate_type aggregate_id event_type actor_type actor_user_id actor_principal_id actor_system_id payload_json policy_commit_sha created_at".split(),
    "duga_analysis_findings": "id analyzer_version repository_commit_sha file_path symbol classification confidence evidence_json status created_at reviewed_at reviewed_by_user_id".split(),
    "duga_jobs": "id job_type status input_json result_json attempts available_at lease_expires_at created_at updated_at".split(),
}

EXPECTED_INDEXES = {
    "uq_duga_assignment_human_active": ("duga_assignments", 1, 1),
    "uq_duga_assignment_ai_active": ("duga_assignments", 1, 1),
    "uq_duga_single_platform_owner": ("duga_assignments", 1, 1),
    "idx_duga_assignments_subject": ("duga_assignments", 0, 0),
    "idx_duga_changes_status_updated": ("duga_change_requests", 0, 0),
    "idx_duga_changes_created": ("duga_change_requests", 0, 0),
    "idx_duga_reviews_change_time": ("duga_reviews", 0, 0),
    "idx_duga_approvals_change_time": ("duga_approvals", 0, 0),
    "idx_duga_validation_change_time": ("duga_validation_runs", 0, 0),
    "idx_duga_validation_status": ("duga_validation_runs", 0, 0),
    "idx_duga_audit_aggregate_time": ("duga_audit_events", 0, 0),
    "idx_duga_audit_actor_time": ("duga_audit_events", 0, 0),
    "idx_duga_audit_time": ("duga_audit_events", 0, 0),
    "idx_duga_findings_status_time": ("duga_analysis_findings", 0, 0),
    "idx_duga_findings_file_commit": ("duga_analysis_findings", 0, 0),
    "idx_duga_jobs_queue": ("duga_jobs", 0, 0),
}

EXPECTED_TRIGGERS = {
    "duga_review_no_implementer_self_audit": ("duga_reviews", "Implementer cannot independently audit"),
    "duga_audit_no_update": ("duga_audit_events", "append-only"),
    "duga_audit_no_delete": ("duga_audit_events", "append-only"),
}

def fail(message: str) -> None:
    raise AssertionError(message)

def main() -> int:
    if not SCHEMA.is_file():
        print(f"FAIL: missing {SCHEMA}", file=sys.stderr)
        return 1
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
    try:
        db.executescript(SCHEMA.read_text(encoding="utf-8"))
        actual_tables = {r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'duga_%'"
        )}
        if actual_tables != set(EXPECTED_COLUMNS):
            fail(f"table inventory mismatch: missing={sorted(set(EXPECTED_COLUMNS)-actual_tables)} extra={sorted(actual_tables-set(EXPECTED_COLUMNS))}")

        for table, expected in EXPECTED_COLUMNS.items():
            actual = [r[1] for r in db.execute(f'PRAGMA table_info("{table}")')]
            if actual != expected:
                fail(f"{table} column order/shape mismatch: expected={expected}, actual={actual}")

        actual_indexes = {}
        for table in EXPECTED_COLUMNS:
            for row in db.execute(f'PRAGMA index_list("{table}")'):
                # seq, name, unique, origin, partial
                actual_indexes[row[1]] = (table, int(row[2]), int(row[4]))
        for name, spec in EXPECTED_INDEXES.items():
            if actual_indexes.get(name) != spec:
                fail(f"index {name} mismatch: expected={spec}, actual={actual_indexes.get(name)}")

        for name, (table, marker) in EXPECTED_TRIGGERS.items():
            row = db.execute(
                "SELECT tbl_name,sql FROM sqlite_master WHERE type='trigger' AND name=?",
                (name,),
            ).fetchone()
            if not row or row[0] != table or marker.lower() not in (row[1] or "").lower():
                fail(f"trigger {name} missing or body marker mismatch")

        # Verify critical foreign-key relationships, including human actor references.
        expected_fks = {
            "duga_assignments": {("assigned_by_user_id", "users", "id"), ("user_id", "users", "id")},
            "duga_change_requests": {("requested_by_user_id", "users", "id"), ("implementer_user_id", "users", "id")},
            "duga_reviews": {("change_request_id", "duga_change_requests", "id"), ("reviewer_user_id", "users", "id")},
            "duga_approvals": {("change_request_id", "duga_change_requests", "id"), ("approver_user_id", "users", "id")},
            "duga_validation_runs": {("change_request_id", "duga_change_requests", "id")},
            "duga_audit_events": {("actor_user_id", "users", "id")},
            "duga_analysis_findings": {("reviewed_by_user_id", "users", "id")},
        }
        for table, expected in expected_fks.items():
            actual = {(r[3], r[2], r[4]) for r in db.execute(f'PRAGMA foreign_key_list("{table}")')}
            if not expected.issubset(actual):
                fail(f"{table} missing foreign keys: {sorted(expected-actual)}")

        # Critical CHECK constraints must remain present in the reviewed DDL.
        ddl = {r[0]: (r[1] or "").lower() for r in db.execute(
            "SELECT name,sql FROM sqlite_master WHERE type='table' AND name LIKE 'duga_%'"
        )}
        required_fragments = {
            "duga_change_requests": ["json_type(affected_systems_json)='array'", "json_type(affected_paths_json)='array')"],
            "duga_jobs": ["status='running' AND lease_expires_at IS NOT NULL", "status<>'running' AND lease_expires_at IS NULL"],
            "duga_analysis_findings": ["reviewed_at is null and reviewed_by_user_id is null"],
            "duga_audit_events": ["length(event_type)>0"],
        }
        for table, fragments in required_fragments.items():
            for fragment in fragments:
                if fragment not in ddl[table]:
                    fail(f"{table} missing critical CHECK fragment: {fragment}")

        print("DUGA deep schema validation: PASS")
        print(f"Tables: {len(actual_tables)} | Indexes: {len(EXPECTED_INDEXES)} | Triggers: {len(EXPECTED_TRIGGERS)}")
        print("Columns, index uniqueness/partial flags, trigger bodies, critical foreign keys and selected CHECK constraints verified.")
        print("LIMITATION: in-memory draft validation only; no live Preview D1 schema was inspected.")
        return 0
    except (sqlite3.Error, AssertionError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    raise SystemExit(main())
