-- DUGA D1 operational schema DRAFT v0.1.0
-- DESIGN ONLY. NOT A MIGRATION. DO NOT EXECUTE.
-- Proposed future filename: migrations/0009_duga_governance_foundation.sql
-- Review docs/DUGA-D1-SCHEMA-DESIGN.md first.
-- Existing app users are human identities; AI principals are stored separately.

CREATE TABLE duga_assignments (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','system')),
  scope_id TEXT,
  role_id TEXT NOT NULL CHECK (role_id IN ('platform-owner','governance-manager','system-owner','ai-maintainer','independent-ai-auditor','read-only-observer')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('human','ai')),
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  principal_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  assigned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  CHECK ((scope_type='platform' AND scope_id IS NULL) OR (scope_type='system' AND scope_id IS NOT NULL AND length(scope_id)>0)),
  CHECK ((role_id IN ('platform-owner','governance-manager','system-owner','read-only-observer') AND subject_type='human') OR
         (role_id IN ('ai-maintainer','independent-ai-auditor') AND subject_type='ai')),
  CHECK ((role_id IN ('platform-owner','governance-manager') AND scope_type='platform') OR
         (role_id IN ('system-owner','ai-maintainer','independent-ai-auditor') AND scope_type='system') OR
         role_id='read-only-observer'),
  CHECK ((subject_type='human' AND user_id IS NOT NULL AND principal_id IS NULL) OR (subject_type='ai' AND user_id IS NULL AND principal_id IS NOT NULL AND length(principal_id)>0)),
  CHECK ((status='active' AND revoked_at IS NULL AND revoked_by_user_id IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL))
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

CREATE TABLE duga_change_requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 10000),
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('proposed','analyzing','impact_review','awaiting_ai_audit','awaiting_human_approval','approved','implementing','validating','final_review','accepted','rejected','cancelled','blocked')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  affected_systems_json TEXT NOT NULL CHECK (json_valid(affected_systems_json) AND json_type(affected_systems_json)='array'),
  affected_paths_json TEXT NOT NULL CHECK (json_valid(affected_paths_json) AND json_type(affected_paths_json)='array'),
  rollback_plan TEXT NOT NULL,
  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('human','ai')),
  requested_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  requested_by_principal_id TEXT,
  source_branch TEXT NOT NULL CHECK (length(source_branch)>0 AND source_branch<>'main'),
  base_commit_sha TEXT,
  policy_commit_sha TEXT NOT NULL,
  implementer_type TEXT CHECK (implementer_type IN ('human','ai')),
  implementer_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  implementer_principal_id TEXT,
  implementation_commit_sha TEXT,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version>0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((requested_by_type='human' AND requested_by_user_id IS NOT NULL AND requested_by_principal_id IS NULL) OR (requested_by_type='ai' AND requested_by_user_id IS NULL AND requested_by_principal_id IS NOT NULL AND length(requested_by_principal_id)>0)),
  CHECK ((implementer_type IS NULL AND implementer_user_id IS NULL AND implementer_principal_id IS NULL) OR
         (implementer_type='human' AND implementer_user_id IS NOT NULL AND implementer_principal_id IS NULL) OR
         (implementer_type='ai' AND implementer_user_id IS NULL AND implementer_principal_id IS NOT NULL AND length(implementer_principal_id)>0))
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
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  created_at INTEGER NOT NULL,
  CHECK ((reviewer_type='human' AND reviewer_user_id IS NOT NULL AND reviewer_principal_id IS NULL AND review_type='human_review') OR
         (reviewer_type='ai' AND reviewer_user_id IS NULL AND reviewer_principal_id IS NOT NULL AND length(reviewer_principal_id)>0 AND review_type='independent_ai_audit'))
);
CREATE INDEX idx_duga_reviews_change_time ON duga_reviews(change_request_id,created_at DESC);

-- Reviews are immutable evidence. Corrections must be represented by a new
-- review record with explicit provenance, not silent mutation or deletion.
CREATE TRIGGER duga_reviews_no_update
BEFORE UPDATE ON duga_reviews
BEGIN SELECT RAISE(ABORT,'DUGA reviews are immutable evidence'); END;
CREATE TRIGGER duga_reviews_no_delete
BEFORE DELETE ON duga_reviews
BEGIN SELECT RAISE(ABORT,'DUGA reviews are immutable evidence'); END;

CREATE TRIGGER duga_review_no_implementer_self_audit
BEFORE INSERT ON duga_reviews
WHEN NEW.review_type='independent_ai_audit'
 AND NEW.reviewer_type='ai'
 AND EXISTS (
   SELECT 1 FROM duga_change_requests c
   WHERE c.id=NEW.change_request_id
     AND c.implementer_type='ai'
     AND c.implementer_principal_id=NEW.reviewer_principal_id
 )
BEGIN
  SELECT RAISE(ABORT,'Implementer cannot independently audit the same change');
END;


CREATE TABLE duga_approvals (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES duga_change_requests(id) ON DELETE RESTRICT,
  approver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approver_role TEXT NOT NULL CHECK (approver_role IN ('system-owner','platform-owner')),
  authorization_assignment_id TEXT NOT NULL REFERENCES duga_assignments(id) ON DELETE RESTRICT,
  authorization_scope_type TEXT NOT NULL CHECK (authorization_scope_type IN ('platform','system')),
  authorization_scope_id TEXT,
  policy_commit_sha TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  approved_commit_sha TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  CHECK ((authorization_scope_type='platform' AND authorization_scope_id IS NULL AND approver_role='platform-owner') OR
         (authorization_scope_type='system' AND authorization_scope_id IS NOT NULL AND length(authorization_scope_id)>0 AND approver_role='system-owner'))
);
CREATE INDEX idx_duga_approvals_change_time ON duga_approvals(change_request_id,created_at DESC);

-- Authorization is checked against the active assignment at insertion time.
-- The assignment ID, scope and policy revision remain as immutable evidence
-- even if the assignment is revoked later.
CREATE TRIGGER duga_approval_authorization_guard
BEFORE INSERT ON duga_approvals
WHEN NOT EXISTS (
  SELECT 1
  FROM duga_assignments a
  JOIN duga_change_requests c ON c.id=NEW.change_request_id
  WHERE a.id=NEW.authorization_assignment_id
    AND a.subject_type='human'
    AND a.user_id=NEW.approver_user_id
    AND a.role_id=NEW.approver_role
    AND a.status='active'
    AND a.scope_type=NEW.authorization_scope_type
    AND a.scope_id IS NEW.authorization_scope_id
    AND c.policy_commit_sha=NEW.policy_commit_sha
    AND (
      (a.role_id='platform-owner' AND a.scope_type='platform' AND a.scope_id IS NULL)
      OR
      (a.role_id='system-owner' AND a.scope_type='system'
       AND EXISTS (
         SELECT 1 FROM json_each(c.affected_systems_json) affected
         WHERE affected.value=a.scope_id
       ))
    )
)
BEGIN
  SELECT RAISE(ABORT,'Approval requires an active scoped assignment and matching policy revision');
END;

-- Approval decisions are immutable evidence; corrections require a new record.
CREATE TRIGGER duga_approvals_no_update
BEFORE UPDATE ON duga_approvals
BEGIN SELECT RAISE(ABORT,'DUGA approvals are immutable evidence'); END;
CREATE TRIGGER duga_approvals_no_delete
BEFORE DELETE ON duga_approvals
BEGIN SELECT RAISE(ABORT,'DUGA approvals are immutable evidence'); END;

CREATE TABLE duga_validation_runs (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES duga_change_requests(id) ON DELETE RESTRICT,
  commit_sha TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','cancelled')),
  validator TEXT NOT NULL,
  validator_version TEXT NOT NULL DEFAULT '',
  results_json TEXT NOT NULL CHECK (json_valid(results_json)),
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (
    (status='queued' AND started_at IS NULL AND completed_at IS NULL)
    OR
    (status='running' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR
    (status IN ('passed','failed') AND started_at IS NOT NULL
      AND completed_at IS NOT NULL AND completed_at>=started_at)
    OR
    (status='cancelled' AND completed_at IS NOT NULL
      AND (started_at IS NULL OR completed_at>=started_at))
  )
);
CREATE INDEX idx_duga_validation_change_time ON duga_validation_runs(change_request_id,created_at DESC);
CREATE INDEX idx_duga_validation_status ON duga_validation_runs(status,created_at);

CREATE TABLE duga_audit_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('change_request','assignment','system','job','finding','platform')),
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(event_type)>0),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human','ai','system')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  actor_principal_id TEXT,
  actor_system_id TEXT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  policy_commit_sha TEXT,
  created_at INTEGER NOT NULL,
  CHECK ((actor_type='human' AND actor_user_id IS NOT NULL AND actor_principal_id IS NULL AND actor_system_id IS NULL) OR
         (actor_type='ai' AND actor_user_id IS NULL AND actor_principal_id IS NOT NULL AND length(actor_principal_id)>0 AND actor_system_id IS NULL) OR
         (actor_type='system' AND actor_user_id IS NULL AND actor_principal_id IS NULL AND actor_system_id IS NOT NULL AND length(actor_system_id)>0))
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

CREATE TRIGGER duga_assignment_grant_audit AFTER INSERT ON duga_assignments
BEGIN
 INSERT INTO duga_audit_events
 (id,aggregate_type,aggregate_id,event_type,actor_type,actor_user_id,payload_json,created_at)
 VALUES ('assignment-grant:'||NEW.id,'assignment',NEW.id,'assignment.granted',
 'human',NEW.assigned_by_user_id,json_object('scope_type',NEW.scope_type,
 'scope_id',NEW.scope_id,'role_id',NEW.role_id,'subject_type',NEW.subject_type,
 'user_id',NEW.user_id,'principal_id',NEW.principal_id),NEW.created_at);
END;
CREATE TRIGGER duga_assignment_revoke_audit AFTER UPDATE ON duga_assignments
WHEN OLD.status='active' AND NEW.status='revoked'
BEGIN
 INSERT INTO duga_audit_events
 (id,aggregate_type,aggregate_id,event_type,actor_type,actor_user_id,payload_json,created_at)
 VALUES ('assignment-revoke:'||NEW.id,'assignment',NEW.id,'assignment.revoked',
 'human',NEW.revoked_by_user_id,json_object('previous_status',OLD.status,
 'status',NEW.status,'revoked_at',NEW.revoked_at),NEW.revoked_at);
END;
CREATE TRIGGER duga_validation_transition_audit AFTER UPDATE ON duga_validation_runs
WHEN OLD.status<>NEW.status
BEGIN
 INSERT INTO duga_audit_events
 (id,aggregate_type,aggregate_id,event_type,actor_type,actor_system_id,payload_json,created_at)
 VALUES ('validation-transition:'||NEW.id||':'||NEW.status,'job',NEW.id,
 'validation.'||NEW.status,'system','duga-db-trigger',
 json_object('previous_status',OLD.status,'status',NEW.status,
 'commit_sha',NEW.commit_sha,'validator',NEW.validator),
 COALESCE(NEW.completed_at,NEW.started_at,NEW.created_at));
END;


CREATE TABLE duga_analysis_findings (
  id TEXT PRIMARY KEY,
  analyzer_version TEXT NOT NULL,
  repository_commit_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  symbol TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('A','B','C','D','E')),
  confidence REAL NOT NULL CHECK (confidence>=0 AND confidence<=1),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','accepted','dismissed','quarantined')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version>0),
  CHECK ((reviewed_at IS NULL AND reviewed_by_user_id IS NULL) OR
         (reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL))
);
CREATE INDEX idx_duga_findings_status_time ON duga_analysis_findings(status,created_at DESC);
CREATE INDEX idx_duga_findings_file_commit ON duga_analysis_findings(file_path,repository_commit_sha);

CREATE TRIGGER duga_finding_review_audit AFTER UPDATE ON duga_analysis_findings
WHEN OLD.status<>NEW.status
BEGIN
 INSERT INTO duga_audit_events
 (id,aggregate_type,aggregate_id,event_type,actor_type,actor_user_id,payload_json,created_at)
 VALUES ('finding-review:'||NEW.id||':'||NEW.state_version,'finding',NEW.id,
 'finding.'||NEW.status,'human',NEW.reviewed_by_user_id,
 json_object('previous_status',OLD.status,'status',NEW.status,
 'state_version',NEW.state_version,'repository_commit_sha',NEW.repository_commit_sha,
 'file_path',NEW.file_path),NEW.reviewed_at);
END;

CREATE TRIGGER duga_assignments_insert_guard
BEFORE INSERT ON duga_assignments
WHEN NEW.status<>'active' OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by_user_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'DUGA assignments must begin active'); END;
CREATE TRIGGER duga_assignments_no_delete
BEFORE DELETE ON duga_assignments
BEGIN SELECT RAISE(ABORT,'DUGA assignment grant evidence cannot be deleted'); END;
CREATE TRIGGER duga_validation_runs_insert_guard
BEFORE INSERT ON duga_validation_runs
WHEN NEW.status<>'queued'
BEGIN SELECT RAISE(ABORT,'DUGA validation runs must begin queued'); END;
CREATE TRIGGER duga_validation_runs_no_delete
BEFORE DELETE ON duga_validation_runs
BEGIN SELECT RAISE(ABORT,'DUGA validation evidence cannot be deleted'); END;
CREATE TRIGGER duga_findings_insert_guard
BEFORE INSERT ON duga_analysis_findings
WHEN NEW.status<>'open' OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by_user_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'DUGA findings must begin open and unreviewed'); END;

CREATE TRIGGER duga_assignments_update_guard
BEFORE UPDATE ON duga_assignments
WHEN NOT (OLD.status='active' AND NEW.status='revoked'
 AND NEW.id=OLD.id AND NEW.scope_type=OLD.scope_type
 AND NEW.scope_id IS OLD.scope_id AND NEW.role_id=OLD.role_id
 AND NEW.subject_type=OLD.subject_type AND NEW.user_id IS OLD.user_id
 AND NEW.principal_id IS OLD.principal_id
 AND NEW.assigned_by_user_id=OLD.assigned_by_user_id
 AND NEW.created_at=OLD.created_at
 AND NEW.revoked_at IS NOT NULL AND NEW.revoked_by_user_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'DUGA assignment permits revocation only'); END;

CREATE TRIGGER duga_findings_update_guard
BEFORE UPDATE ON duga_analysis_findings
WHEN NOT (
 NEW.id=OLD.id AND NEW.analyzer_version=OLD.analyzer_version
 AND NEW.repository_commit_sha=OLD.repository_commit_sha
 AND NEW.file_path=OLD.file_path AND NEW.symbol IS OLD.symbol
 AND NEW.classification=OLD.classification AND NEW.confidence=OLD.confidence
 AND NEW.evidence_json=OLD.evidence_json AND NEW.created_at=OLD.created_at
 AND OLD.status IN ('open','under_review')
 AND NEW.status IN ('under_review','accepted','dismissed','quarantined')
 AND NEW.state_version=OLD.state_version+1
 AND NEW.reviewed_at IS NOT NULL AND NEW.reviewed_by_user_id IS NOT NULL
 AND (OLD.status='open' OR NEW.status IN ('accepted','dismissed','quarantined')))
BEGIN SELECT RAISE(ABORT,'Invalid DUGA finding review transition'); END;
CREATE TRIGGER duga_findings_no_delete
BEFORE DELETE ON duga_analysis_findings
BEGIN SELECT RAISE(ABORT,'DUGA finding evidence is immutable'); END;

CREATE TRIGGER duga_validation_runs_update_guard
BEFORE UPDATE ON duga_validation_runs
WHEN NOT (
 NEW.id=OLD.id AND NEW.change_request_id=OLD.change_request_id
 AND NEW.commit_sha=OLD.commit_sha AND NEW.validator=OLD.validator
 AND NEW.validator_version=OLD.validator_version AND NEW.created_at=OLD.created_at
 AND OLD.status IN ('queued','running')
 AND ((OLD.status='queued' AND NEW.status='running'
       AND NEW.started_at IS NOT NULL AND NEW.completed_at IS NULL)
   OR (OLD.status='queued' AND NEW.status='cancelled'
       AND NEW.started_at IS NULL AND NEW.completed_at IS NOT NULL)
   OR (OLD.status='running' AND NEW.status IN ('passed','failed','cancelled')
       AND NEW.started_at=OLD.started_at AND NEW.completed_at IS NOT NULL
       AND NEW.completed_at>=OLD.started_at)))
BEGIN SELECT RAISE(ABORT,'Invalid DUGA validation-run transition'); END;

CREATE TABLE duga_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('validation','static_analysis','dependency_scan','audit_export')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0),
  available_at INTEGER NOT NULL,
  lease_owner TEXT,
  lease_token TEXT,
  lease_generation INTEGER NOT NULL DEFAULT 0 CHECK (lease_generation>=0),
  lease_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status='running' AND lease_owner IS NOT NULL AND length(lease_owner)>0
      AND lease_token IS NOT NULL AND length(lease_token)>0
      AND lease_generation>0 AND lease_expires_at IS NOT NULL)
    OR
    (status<>'running' AND lease_owner IS NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL)
  )
);
CREATE INDEX idx_duga_jobs_queue ON duga_jobs(status,available_at);
CREATE UNIQUE INDEX uq_duga_jobs_active_lease_token
  ON duga_jobs(lease_token) WHERE status='running';

-- Every claim/reclaim advances both attempt count and fencing generation.
-- Heartbeats retain the current lease identity; completion/release clears it.
-- The API must still use a conditional UPDATE matching token, generation and
-- unexpired lease; this trigger is a database-level consistency backstop.
CREATE TRIGGER duga_jobs_lease_transition_guard
BEFORE UPDATE ON duga_jobs
WHEN NOT (
  NEW.id=OLD.id
  AND NEW.job_type=OLD.job_type
  AND NEW.input_json=OLD.input_json
  AND NEW.available_at=OLD.available_at
  AND NEW.created_at=OLD.created_at
  AND NEW.updated_at>=OLD.updated_at
  AND (
    (OLD.status='queued' AND NEW.status='running'
      AND NEW.result_json IS OLD.result_json
      AND NEW.lease_generation=OLD.lease_generation+1
      AND NEW.attempts=OLD.attempts+1
      AND NEW.lease_owner IS NOT NULL AND length(NEW.lease_owner)>0
      AND NEW.lease_token IS NOT NULL AND length(NEW.lease_token)>0
      AND NEW.lease_expires_at IS NOT NULL)
    OR
    (OLD.status='running' AND NEW.status='running'
      AND NEW.result_json IS OLD.result_json
      AND NEW.lease_generation=OLD.lease_generation
      AND NEW.attempts=OLD.attempts
      AND NEW.lease_owner=OLD.lease_owner
      AND NEW.lease_token=OLD.lease_token
      AND NEW.lease_expires_at>=OLD.lease_expires_at)
    OR
    (OLD.status='running' AND NEW.status='running'
      AND NEW.result_json IS OLD.result_json
      AND NEW.lease_generation=OLD.lease_generation+1
      AND NEW.attempts=OLD.attempts+1
      AND NEW.lease_token<>OLD.lease_token
      AND NEW.lease_owner IS NOT NULL AND length(NEW.lease_owner)>0
      AND NEW.lease_token IS NOT NULL AND length(NEW.lease_token)>0
      AND NEW.lease_expires_at IS NOT NULL)
    OR
    (OLD.status='running' AND NEW.status IN ('succeeded','failed','cancelled','queued')
      AND NEW.lease_owner IS NULL AND NEW.lease_token IS NULL
      AND NEW.lease_expires_at IS NULL
      AND NEW.lease_generation=OLD.lease_generation
      AND NEW.attempts=OLD.attempts)
    OR
    (OLD.status='queued' AND NEW.status='queued'
      AND NEW.result_json IS OLD.result_json
      AND NEW.lease_owner IS NULL AND NEW.lease_token IS NULL
      AND NEW.lease_expires_at IS NULL
      AND NEW.lease_generation=OLD.lease_generation
      AND NEW.attempts=OLD.attempts)
  )
)
BEGIN
  SELECT RAISE(ABORT,'Invalid DUGA job lease transition or immutable job identity mutation');
END;
