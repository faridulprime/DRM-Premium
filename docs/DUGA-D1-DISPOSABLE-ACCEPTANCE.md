


## 12. Shared Preview D1 read-only preflight — 2026-11-25

Owner-supplied Cloudflare screenshots establish the following configuration labels and identifier:
- D1 database list: `drmdatabase-preview`, UUID `6821a135-9330-4537-9cf8-eb9ca90970b8`.
- Pages project `drm-premium`, Preview environment: binding `DB` points to `drmdatabase-preview`.
- Pages project `drm-premium`, Production environment: binding `DB` points to `drmdatabase`.
- The isolated acceptance Worker `duga-d1-acceptance-v2-disposable` binds `DB` to `drm-duga-acceptance-v2-disposable`, not to either Pages database.

Read-only Preview Console observations:
- Existing application tables include `users`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `videos`, and `visitor_presence`.
- The visible `users` table has `id TEXT PRIMARY KEY`, `email TEXT NOT NULL UNIQUE COLLATE NOCASE`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL DEFAULT 'admin'`, `created_at INTEGER NOT NULL`, nullable `username`, and `email_verified INTEGER NOT NULL DEFAULT 1`.
- Migration/meta table-name discovery returned no rows; this is not proof that no migration mechanism exists.
- The `duga_%` object discovery query returned no rows.
- `PRAGMA foreign_key_check;` displayed no violation rows.
- `PRAGMA foreign_keys;` returned `1` in the Console session.
- The supplied index screenshot is incomplete and cannot certify the exact total or every definition.

Evidence qualification: the screenshots are owner-supplied, not independent account access. The D1 list UUID and Pages Preview binding label match. The screenshots do not prove the runtime binding of every deployed Pages version or reveal migration history beyond the query results. No schema/data change, migration, binding change, deployment, or Production action was performed. The DUGA schema remains a design draft, not a migration.

**Preview migration rollout and DUGA write endpoints remain NO-GO** pending actual migration-history/repository-sequence reconciliation, complete schema/index/trigger inventory, independent review, trusted service identity, and application integration tests.


## 13. Recorded owner-operated CAS + audit run — 2026-11-25

Draft PR #4 records this owner-operated run against the pinned disposable database only:
- Database: `drm-duga-acceptance-disposable`
- Database ID: `6d512429-34a3-498b-9430-45f11d382da9`
- Worker: `duga-d1-acceptance-disposable`
- Run ID: `53d70371-008c-46a0-8bc3-33522be990eb`
- Completion timestamp: `2026-11-25T01:04:19.420Z`
- Recorded aggregate result: PASS

The Worker returns individual `meta.changes` results and computes PASS only when its documented success, stale, replay, token-reuse, rollback and competing-writer predicates hold. The saved PowerShell output recorded in the PR displayed the aggregate PASS rather than the nested per-case counts; do not claim the saved console transcript independently proves each displayed count.

**Schema qualification:** this run predates the later `parent_change_request_id` self-reference/immutability additions and the SQL guard preventing AI reviewers from recording terminal rejection. The lifecycle review explicitly marks revised-schema D1 acceptance as NOT RUN. Therefore the recorded PASS applies only to the earlier disposable fixture/schema used at that time; it does not close the current revised-schema acceptance gate.

The current disposable fixture and comment-free Console SQL are now source-synchronized and covered by `scripts/test-duga-fixture-sync.py`, which is added to the DUGA schema smoke workflow. That test is a local SQLite source-parity check, not a replacement for a new Cloudflare D1 acceptance run.

No shared Preview or Production database was used by the recorded run. Preview migration-history reconciliation and DUGA write-endpoint readiness remain NO-GO.
