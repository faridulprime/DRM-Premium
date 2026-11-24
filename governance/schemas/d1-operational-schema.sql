-- DUGA D1 operational schema DRAFT v0.1.0
-- DESIGN ONLY. NOT A MIGRATION. DO NOT EXECUTE.
-- Proposed future filename: migrations/0009_duga_governance_foundation.sql
-- Review docs/DUGA-D1-SCHEMA-DESIGN.md first.
-- Existing app users are human identities; AI principals are stored separately.

CREATE TABLE duga_assignments (
  id TEXT PRIMARY KEY CHECK (length(trim(id))>0),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','system')),
  scope_id TEXT,
  role_id TEXT NOT NULL CHECK (role_id IN ('platform-owner','governance-manager','system-owner','ai-maintainer','independent-ai-auditor','read-only-observer')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('human','ai')),
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  principal_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  assigned_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK ((scope_type='platform' AND scope_id IS NULL) OR (scope_type='system' AND scope_id IS NOT NULL AND length(scope_id)>0)),
  CHECK ((role_id IN ('platform-owner','governance-manager','system-owner','read-only-observer') AND subject_type='human') OR
         (role_id IN ('ai-maintainer','independent-ai-auditor') AND subject_type='ai')),
  CHECK ((role_id IN ('platform-owner','governance-manager') AND scope_type='platform') OR
         (role_id IN ('system-owner','ai-maintainer','independent-ai-auditor') AND scope_type='system') OR
         role_id='read-only-observer'),
  CHECK ((subject_type='human' AND user_id IS NOT NULL AND principal_id IS NULL) OR (subject_type='ai' AND user_id IS NULL AND principal_id IS NOT NULL AND length(trim(principal_id))>0)),
  CHECK ((status='active' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL AND revoked_at>=created_at))
);
CREATE UNIQUE INDEX uq_duga_assignment_human_active
  ON duga_assignments(scope_type,ifnull(scope_id,''),role_id,user_id)
  WHERE status='active' AND subject_type='human';
CREATE UNIQUE INDEX uq_duga_assignment_ai_active
  ON duga_assignments(scope_type,ifnull(scope_id,''),role_id,principal_id)
  WHERE status='active' AND subject_type='ai';
CREATE INDEX idx_duga_assignments_subject ON duga_assignments(user_id,principal_id,status);
CREATE UNIQUE INDEX uq_duga_single_platform_owner
  ON duga_assignments(scope_type,role_id)
  WHERE scope_type='platform' AND role_id='platform-owner' AND status='active';
-- A registered system has one accountable human System Owner at a time.
-- Historical revoked assignments remain available for audit and reassignment.
CREATE UNIQUE INDEX uq_duga_single_system_owner
  ON duga_assignments(scope_id,role_id)
  WHERE scope_type='system' AND role_id='system-owner' AND status='active';

CREATE TABLE duga_change_requests (
  id TEXT PRIMARY KEY CHECK (length(trim(id))>0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 10000),
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('proposed','analyzing','impact_review','awaiting_ai_audit','awaiting_human_approval','approved','implementing','validating','final_review','accepted','rejected','cancelled','blocked')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  affected_systems_json TEXT NOT NULL CHECK (json_valid(affected_systems_json) AND json_type(affected_systems_json)='array'),
  affected_paths_json TEXT NOT NULL CHECK (json_valid(affected_paths_json) AND json_type(affected_paths_json)='array'),
  rollback_plan TEXT NOT NULL CHECK (length(trim(rollback_plan))>0),
  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('human','ai')),
  requested_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  requested_by_principal_id TEXT,
  source_branch TEXT NOT NULL CHECK (length(trim(source_branch))>0 AND source_branch<>'main'),
  base_commit_sha TEXT,
  policy_commit_sha TEXT NOT NULL CHECK (length(trim(policy_commit_sha))>0),
  implementer_type TEXT CHECK (implementer_type IN ('human','ai')),
  implementer_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  implementer_principal_id TEXT,
  implementation_commit_sha TEXT,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version>0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((requested_by_type='human' AND requested_by_user_id IS NOT NULL AND requested_by_principal_id IS NULL) OR (requested_by_type='ai' AND requested_by_user_id IS NULL AND requested_by_principal_id IS NOT NULL AND length(trim(requested_by_principal_id))>0)),
  CHECK ((implementer_type IS NULL AND implementer_user_id IS NULL AND implementer_principal_id IS NULL) OR
         (implementer_type='human' AND implementer_user_id IS NOT NULL AND implementer_principal_id IS NULL) OR
         (implementer_type='ai' AND implementer_user_id IS NULL AND implementer_principal_id IS NOT NULL AND length(trim(implementer_principal_id))>0)),
  CHECK (updated_at>=created_at)
);
CREATE INDEX idx_duga_changes_status_updated ON duga_change_requests(status,updated_at DESC);
CREATE INDEX idx_duga_changes_created ON duga_change_requests(created_at DESC);

CREATE TABLE duga_reviews (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES duga_change_requests(id) ON DELETE RESTRICT,
  review_type TEXT NOT NULL CHECK (review_type IN ('independent_ai_audit','human_review')),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('human','ai')),
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_principal_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  reviewed_commit_sha TEXT NOT NULL,
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json) AND json_type(evidence_json)='object'),
  created_at INTEGER NOT NULL,
  CHECK ((reviewer_type='human' AND reviewer_user_id IS NOT NULL AND reviewer_principal_id IS NULL AND review_type='human_review') OR
         (reviewer_type='ai' AND reviewer_user_id IS NULL AND reviewer_principal_id IS NOT NULL AND length(trim(reviewer_principal_id))>0 AND review_type='independent_ai_audit'))
);
CREATE INDEX idx_duga_reviews_change_time ON duga_reviews(change_request_id,created_at DESC);

CREATE TABLE duga_approvals (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES duga_change_requests(id) ON DELETE RESTRICT,
  approver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approver_role TEXT NOT NULL CHECK (approver_role IN ('system-owner','platform-owner')),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  approved_commit_sha TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_duga_approvals_change_time ON duga_approvals(change_request_id,created_at DESC);

CREATE TABLE duga_validation_runs (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES duga_change_requests(id) ON DELETE RESTRICT,
  commit_sha TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','cancelled')),
  validator TEXT NOT NULL CHECK (length(trim(validator))>0),
  validator_version TEXT NOT NULL DEFAULT '',
  results_json TEXT NOT NULL CHECK (json_valid(results_json) AND json_type(results_json)='object'),
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK ((started_at IS NULL AND completed_at IS NULL) OR
         (started_at IS NOT NULL AND (completed_at IS NULL OR completed_at>=started_at))),
  CHECK ((status='queued' AND started_at IS NULL AND completed_at IS NULL) OR
         (status='running' AND started_at IS NOT NULL AND completed_at IS NULL) OR
         (status IN ('passed','failed') AND started_at IS NOT NULL AND completed_at IS NOT NULL) OR
         (status='cancelled' AND ((started_at IS NULL AND completed_at IS NULL) OR
                                  (started_at IS NOT NULL AND completed_at IS NOT NULL))))
);
CREATE INDEX idx_duga_validation_change_time ON duga_validation_runs(change_request_id,created_at DESC);
CREATE INDEX idx_duga_validation_status ON duga_validation_runs(status,created_at);

CREATE TABLE duga_audit_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('change_request','assignment','system','job','finding','platform')),
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(trim(event_type))>0),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human','ai','system')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  actor_principal_id TEXT,
  actor_system_id TEXT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json)='object'),
  policy_commit_sha TEXT,
  created_at INTEGER NOT NULL,
  CHECK ((actor_type='human' AND actor_user_id IS NOT NULL AND actor_principal_id IS NULL AND actor_system_id IS NULL) OR
         (actor_type='ai' AND actor_user_id IS NULL AND actor_principal_id IS NOT NULL AND length(trim(actor_principal_id))>0 AND actor_system_id IS NULL) OR
         (actor_type='system' AND actor_user_id IS NULL AND actor_principal_id IS NULL AND actor_system_id IS NOT NULL AND length(trim(actor_system_id))>0))
);
CREATE INDEX idx_duga_audit_aggregate_time ON duga_audit_events(aggregate_type,aggregate_id,created_at DESC);
CREATE INDEX idx_duga_audit_actor_time ON duga_audit_events(actor_type,actor_user_id,actor_principal_id,created_at DESC);
CREATE INDEX idx_duga_audit_time ON duga_audit_events(created_at DESC);
CREATE TRIGGER duga_audit_no_update
BEFORE UPDATE ON duga_audit_events
BEGIN SELECT RAISE(ABORT,'DUGA audit events are append-only'); END;
CREATE TRIGGER duga_audit_no_delete
BEFORE DELETE ON duga_audit_events
BEGIN SELECT RAISE(ABORT,'DUGA audit events are append-only'); END;

CREATE TABLE duga_analysis_findings (
  id TEXT PRIMARY KEY,
  analyzer_version TEXT NOT NULL,
  repository_commit_sha TEXT NOT NULL,
  file_path TEXT NOT NULL CHECK (length(trim(file_path))>0),
  symbol TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('A','B','C','D','E')),
  confidence REAL NOT NULL CHECK (confidence>=0 AND confidence<=1),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json) AND json_type(evidence_json)='object'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','accepted','dismissed','quarantined')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  CHECK ((reviewed_at IS NULL AND reviewed_by_user_id IS NULL) OR
         (reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at>=created_at))
);
CREATE INDEX idx_duga_findings_status_time ON duga_analysis_findings(status,created_at DESC);
CREATE INDEX idx_duga_findings_file_commit ON duga_analysis_findings(file_path,repository_commit_sha);

CREATE TABLE duga_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('validation','static_analysis','dependency_scan','audit_export')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  input_json TEXT NOT NULL CHECK (json_valid(input_json) AND json_type(input_json)='object'),
  result_json TEXT CHECK (result_json IS NULL OR (json_valid(result_json) AND json_type(result_json)='object')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0),
  available_at INTEGER NOT NULL,
  lease_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (updated_at>=created_at),
  CHECK ((status='queued' AND lease_expires_at IS NULL) OR
         (status='running' AND lease_expires_at IS NOT NULL) OR
         (status IN ('succeeded','failed','cancelled') AND lease_expires_at IS NULL)),
  CHECK (status<>'succeeded' OR result_json IS NOT NULL)
);
CREATE INDEX idx_duga_jobs_queue ON duga_jobs(status,available_at);
