# DUGA Draft Schema Review Findings

Date: 2026-11-25
Reviewed ref: `feature/full-admin-panel`
Reviewed schema: `governance/schemas/d1-operational-schema.sql` (design-only draft v0.1.0)
Status: Static design review; findings are not proof of an exploitable deployed system. The draft is not applied to D1.

## Scope and limits

This review inspected the SQL draft and its stated lifecycle/authorization design. It did not inspect the shared Preview D1 schema or migration ledger, execute a migration, test Cloudflare D1, or perform an independent third-party security audit. The existing API is read-only for governance routes; no governance write endpoint is implemented.

## Findings

### F-01 — Review self-audit protection only runs on INSERT

**Evidence:** `duga_review_no_implementer_self_audit` is a `BEFORE INSERT ON duga_reviews` trigger. The table has no corresponding UPDATE guard.

**Risk:** A row could be inserted with a valid independent reviewer and later updated so that `reviewer_principal_id` matches the AI implementer, while the insert-only trigger is not re-evaluated. The draft also has no review-row immutability trigger, so existing review evidence can be updated or deleted without a corresponding database-level block.

**Resolution in current draft:** Reviews are now explicitly immutable evidence. New `BEFORE UPDATE` and `BEFORE DELETE` triggers reject mutation/deletion; corrections must be represented as new review records with provenance. Regression tests cover attempts to mutate reviewer identity and delete a review, and the structural validator checks both trigger operations. This is defense in depth, not reviewer authentication; trusted actor derivation and commit binding remain API responsibilities.

### F-02 — Approval records are mutable and lack database-level assignment binding

**Resolution in current draft:** `duga_approvals` now records the exact authorization assignment ID, scope snapshot and policy commit SHA. A `BEFORE INSERT` trigger checks that the assignment is active, human, belongs to the approver, matches the stated role and scope, and covers an affected system (or is the platform-wide Platform Owner assignment). Approval UPDATE/DELETE are rejected. SQLite regression cases cover valid approval, mismatched scope/user, stale policy, revoked assignment and evidence mutation/deletion. This remains defense in depth: trusted session authentication and server-side actor derivation are still API responsibilities.

**Evidence:** `duga_approvals` has no UPDATE/DELETE protection. `approver_user_id` is a foreign key to `users`, while `approver_role` is a caller-populated enum; no SQL constraint or trigger proves that the user held the stated active `system-owner` or `platform-owner` assignment for the relevant scope at approval time.

**Risk:** The table alone cannot prove the approver was authorized, and stored approval evidence can be silently changed or removed. The design correctly requires API authorization, but database rows do not independently attest to it.

**Recommendation:** Keep authorization derived server-side from a trusted session and active scoped assignment. Store a policy/assignment snapshot or immutable authorization evidence (including scope and policy revision) with the approval. Decide and enforce approval-record immutability; test role revocation/change and post-approval mutation behavior.

### F-03 — Validation-run lifecycle has no timestamp/status consistency constraints

**Resolution in current draft:** Status-specific CHECK constraints now require queued=(no timestamps), running=(started, not completed), passed/failed=(started and completed, ordered), and cancelled=(completed; start may be absent only for cancellation before execution). The in-memory regression suite covers valid and invalid cases for all five statuses. Trusted runner identity and result provenance remain API responsibilities.

**Evidence:** `duga_validation_runs` allows `queued`, `running`, `passed`, `failed`, and `cancelled`, with nullable `started_at` and `completed_at`, but no CHECK pairing these fields with status. Rows can represent a passed run with no completion time, or a queued run with completion metadata.

**Risk:** Consumers may treat inconsistent or incomplete validation records as evidence that a commit passed.

**Recommendation:** Define allowed timestamp invariants per status and encode them as CHECK constraints where practical; validate trusted runner identity and result provenance in the API. Add negative and positive tests for each lifecycle state.

### F-04 — Job lease has no owner or fencing token

**Resolution in current draft:** `duga_jobs` now stores `lease_owner`, per-claim `lease_token`, and monotonic `lease_generation`; attempts advance with generation on claims/reclaims. A partial unique index prevents a token being active on multiple jobs. The lease-transition trigger enforces claim/reclaim generation increments, stable heartbeat identity, and lease clearing on completion. SQLite regression cases cover heartbeat, expired-lease reclaim, stale-token operations, skipped generations and valid completion.

**Remaining runtime requirement:** A worker API must use one conditional `UPDATE ... RETURNING` for claim/reclaim and require exact job ID, running status, token, generation and unexpired lease on heartbeat/completion. Zero returned rows means stale worker. This remains a design-only SQLite check; no D1 worker or concurrency test has run.

### F-05 — Operational evidence tables do not share the audit table's append-only protection

**Resolution in current draft:** Evidence/state classification is documented. Reviews, approvals and audit events are fully immutable. Assignment grant identity is immutable; only one-way revocation is allowed and the revoker is recorded. Validation identity is immutable and lifecycle transitions are restricted; terminal rows cannot change. Finding analyzer evidence is immutable, review status is versioned and reviewer-attributed, and findings cannot be deleted. Assignment, validation and finding state changes automatically create audit rows through database triggers in the same statement.

**Important limitation:** Validation audit actor `duga-db-trigger` records that a transition occurred but does not authenticate the external runner. API/session actor derivation, state-version compare-and-swap, runner provenance and genuine result verification remain runtime requirements. This is in-memory SQLite design validation, not live D1 acceptance.

## Positive controls already present

- Human and AI identities are separated by CHECK constraints and human foreign keys.
- Assignment role-kind and scope pairings are constrained.
- Active assignment uniqueness and single active Platform Owner are indexed.
- AI implementer cannot insert its own independent audit.
- Audit events reject UPDATE and DELETE.
- Human references use `ON DELETE RESTRICT`; validator checks FK update/delete actions.
- Change requests have a positive `state_version` suitable for a future compare-and-swap API, although no write API currently uses it.

## Required next steps

1. Obtain an independent reviewer for SQL, API authorization, state machine, CAS, and audit semantics.
2. F-01 through F-05 have draft-level schema resolutions; independent review, runtime authorization/provenance and Preview D1 acceptance remain open.
3. Extend the schema regression tests and structural validator to cover the chosen invariants.
4. Only after design review, test the revised draft on a fresh disposable D1. First verify the shared Preview migration history and backup; do not infer either from repository filenames or the manifest.
5. Keep Production untouched and do not deploy or apply migrations without explicit authorization.

