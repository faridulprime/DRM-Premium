-- DUGA revised-schema acceptance gap probes
-- TARGET ONLY: drm-duga-acceptance-v2-disposable
-- D1 ID: 716a4f20-25a5-4a59-9dd2-c764b193f385
-- Execute ONE statement at a time in Cloudflare D1 Console.
-- Never run against Production/shared Preview. Do not paste secrets.
-- Expected failures are labelled EXPECT ERROR; a successful INSERT there is a test failure.
-- All IDs below use a dedicated gap-probe prefix to avoid collisions with prior probes.

-- 0. Read-only schema inventory: expected 20 indexes and 3 triggers for current fixture.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('index','trigger')
  AND name NOT LIKE 'sqlite_%'
  AND (name LIKE 'idx_duga_%' OR name LIKE 'uq_duga_%' OR name LIKE 'duga_%')
ORDER BY type, name;

-- 1. Create the synthetic human FK target.
-- EXPECT SUCCESS; if the ID already exists, use another unique suffix consistently below.
INSERT INTO users(id) VALUES ('duga-gap-probe-human');

-- 2. Create one valid change request used as parent for review/FK probes.
-- EXPECT SUCCESS.
INSERT INTO duga_change_requests (
  id,title,summary,rationale,status,risk_level,
  affected_systems_json,affected_paths_json,rollback_plan,
  requested_by_type,requested_by_user_id,source_branch,policy_commit_sha,
  state_version,created_at,updated_at
) VALUES (
  'duga-gap-probe-cr',
  'D1 acceptance gap probe',
  'Synthetic parent row for FK and positive-shape probes',
  '',
  'proposed','low',
  '[]','[]','Synthetic rollback plan',
  'human','duga-gap-probe-human','duga-gap-probe-branch',
  'duga-gap-probe-policy',1,1795600000,1795600000
);

-- 3. Assignment positive counterpart.
-- EXPECT SUCCESS: human read-only observer, both user FKs resolve.
INSERT INTO duga_assignments (
  id,scope_type,scope_id,role_id,subject_type,user_id,status,
  assigned_by_user_id,created_at
) VALUES (
  'duga-gap-probe-assignment-valid','system','duga-gap-probe-system',
  'read-only-observer','human','duga-gap-probe-human','active',
  'duga-gap-probe-human',1795600000
);

-- 4. Assignment orphan user_id.
-- EXPECT ERROR: FOREIGN KEY constraint failed.
INSERT INTO duga_assignments (
  id,scope_type,scope_id,role_id,subject_type,user_id,status,
  assigned_by_user_id,created_at
) VALUES (
  'duga-gap-probe-assignment-orphan-user','system','duga-gap-probe-system',
  'read-only-observer','human','duga-gap-missing-user','active',
  'duga-gap-probe-human',1795600001
);

-- 5. Assignment orphan assigned_by_user_id.
-- EXPECT ERROR: FOREIGN KEY constraint failed.
INSERT INTO duga_assignments (
  id,scope_type,scope_id,role_id,subject_type,user_id,status,
  assigned_by_user_id,created_at
) VALUES (
  'duga-gap-probe-assignment-orphan-assigner','system','duga-gap-probe-system',
  'read-only-observer','human','duga-gap-probe-human','active',
  'duga-gap-missing-assigner',1795600002
);

-- 6. Review orphan reviewer_user_id (change_request_id is valid).
-- EXPECT ERROR: FOREIGN KEY constraint failed.
INSERT INTO duga_reviews (
  id,change_request_id,review_type,reviewer_type,reviewer_user_id,
  decision,reviewed_commit_sha,evidence_json,created_at
) VALUES (
  'duga-gap-probe-review-orphan-reviewer','duga-gap-probe-cr',
  'human_review','human','duga-gap-missing-reviewer',
  'rejected','duga-gap-probe-commit','{}',1795600003
);

-- 7. Review positive counterpart.
-- EXPECT SUCCESS: human rejection remains permitted; valid object JSON.
INSERT INTO duga_reviews (
  id,change_request_id,review_type,reviewer_type,reviewer_user_id,
  decision,reviewed_commit_sha,evidence_json,created_at
) VALUES (
  'duga-gap-probe-review-valid','duga-gap-probe-cr',
  'human_review','human','duga-gap-probe-human',
  'rejected','duga-gap-probe-commit','{}',1795600004
);

-- 8. Positive JSON shape counterparts: one valid object per remaining object field.
-- EXPECT SUCCESS for each statement.
INSERT INTO duga_validation_runs (
  id,change_request_id,commit_sha,status,validator,results_json,created_at
) VALUES (
  'duga-gap-probe-validation-valid','duga-gap-probe-cr',
  'duga-gap-probe-commit','queued','duga-gap-probe-validator','{}',1795600005
);

INSERT INTO duga_analysis_findings (
  id,analyzer_version,repository_commit_sha,file_path,classification,
  confidence,evidence_json,created_at
) VALUES (
  'duga-gap-probe-finding-valid','probe-v1','duga-gap-probe-commit',
  'probe/example.js','A',0.5,'{}',1795600006
);

INSERT INTO duga_jobs (
  id,job_type,status,input_json,result_json,attempts,available_at,
  created_at,updated_at
) VALUES (
  'duga-gap-probe-job-valid','static_analysis','queued','{}',NULL,0,
  1795600007,1795600007,1795600007
);

-- 9. Positive JSON array counterpart for change-request fields is covered by
-- the successful parent row above ('[]','[]'). Verify exact values:
SELECT id, json_type(affected_systems_json) AS systems_type,
       json_type(affected_paths_json) AS paths_type
FROM duga_change_requests
WHERE id='duga-gap-probe-cr';

-- 10. Verify expected object inventory and full index/trigger definitions.
-- Save this complete output with the acceptance evidence.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE name IN (
 'uq_duga_assignment_human_active','uq_duga_assignment_ai_active',
 'idx_duga_assignments_subject','uq_duga_single_platform_owner',
 'uq_duga_single_system_owner','idx_duga_changes_parent',
 'idx_duga_changes_status_updated','idx_duga_changes_created',
 'idx_duga_reviews_change_time','idx_duga_approvals_change_time',
 'idx_duga_validation_change_time','idx_duga_validation_status',
 'idx_duga_audit_aggregate_time','idx_duga_audit_actor_time',
 'idx_duga_audit_time','uq_duga_audit_transition_id',
 'idx_duga_findings_status_time','idx_duga_findings_file_commit',
 'idx_duga_jobs_queue','duga_change_parent_immutable',
 'duga_audit_no_update','duga_audit_no_delete'
)
ORDER BY type, name;

-- 11. Final referential-integrity check.
-- EXPECT ZERO ROWS.
PRAGMA foreign_key_check;

-- 12. Verify successful positive rows exist.
SELECT 'assignment_valid' AS probe, count(*) AS rows_found
FROM duga_assignments WHERE id='duga-gap-probe-assignment-valid'
UNION ALL
SELECT 'human_rejected_review', count(*)
FROM duga_reviews WHERE id='duga-gap-probe-review-valid'
UNION ALL
SELECT 'validation_object_json', count(*)
FROM duga_validation_runs WHERE id='duga-gap-probe-validation-valid'
UNION ALL
SELECT 'finding_object_json', count(*)
FROM duga_analysis_findings WHERE id='duga-gap-probe-finding-valid'
UNION ALL
SELECT 'job_object_json', count(*)
FROM duga_jobs WHERE id='duga-gap-probe-job-valid';
