# D1 Migration Recovery and Safe Adoption Plan

Status: Investigation complete; execution blocked pending explicit approval
Branch: feature/full-admin-panel
Repository baseline: 0a3cf1fa34bca83a8542b4f7792ece47d26a388a
Database inspected by the project owner: Preview D1 database `drmdatabase-migration-test`
Last reviewed: 2026-11-25

## 1. Executive finding

The Preview D1 database contains the expected application tables and indexes for the repository's existing migration set, but the inspected schema does not contain a migration-history table. A query against `sqlite_master` for table names containing `migration` or `meta` returned no rows. The broader schema inventory also showed no `d1_migrations` table.

This establishes that no migration-history table was visible in the inspected database at the time of inspection. It does **not** establish exactly which SQL files were executed, in what order, or whether every column and constraint matches the current migration files. The database may have been populated by manual SQL execution in Cloudflare's D1 Console.

The repository's `migrations/manifest.json` is documentation-only. It explicitly says Wrangler migrations are not configured and that the manifest does not record applied migrations.

**Do not run `wrangler d1 migrations apply` against this database yet.** If the Wrangler history table is absent or empty, Wrangler may consider every local migration unapplied and attempt to execute old migrations against existing tables. Several old files contain non-idempotent `ALTER TABLE` statements.

## 2. Evidence collected

### Repository evidence

- Existing SQL files: 10 files, from `0001_admin.sql` through `0008_user_profiles.sql`.
- Duplicate numeric prefixes:
  - `0004_admin_analytics.sql` and `0004_owner_email_otp.sql`
  - `0007_user_registration.sql` and `0007_user_restrictions_and_activity.sql`
- Both files in each duplicate-prefix pair are required; numeric prefix alone is not a unique migration identity.
- `migrations/manifest.json` states:
  - `wrangler_migrations_configured: false`
  - `automatic: false`
  - It is not a Wrangler configuration or an applied-state ledger.
- No Wrangler configuration file was found in the inspected repository tree at the recorded baseline.

### Preview D1 evidence supplied by the project owner

The read-only `sqlite_master` inventory showed these 17 application tables:

`admin_presence`, `analytics_events`, `categories`, `login_attempts`, `owner_setup_otps`, `sessions`, `settings`, `site_builder_documents`, `site_builder_revisions`, `user_activity_hours`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `users`, `videos`, `visitor_presence`, plus the table `_cf_KV` maintained by Cloudflare.

The same inventory showed 17 named application indexes. No application triggers were listed. The separate migration/meta table lookup returned no rows.

The observed tables align with the objects expected from the repository's existing migration files. This is a structural consistency signal only—not proof of exact migration lineage, column definitions, constraint equivalence, or data correctness.

### Evidence still missing

- Full `PRAGMA table_info` output for all tables, beginning with `users`.
- Full index SQL and foreign-key definitions compared against each migration.
- A database export/backup and confirmation that it can be restored.
- Exact Cloudflare D1 database ID/environment binding and confirmation that the inspected database is Preview only.
- Confirmation of the exact Wrangler version that will be used if Wrangler adoption is chosen.

## 3. Immediate safety rules

1. Do not execute old migrations against the existing Preview database.
2. Do not run `wrangler d1 migrations apply` until a verified baseline exists.
3. Do not assume `wrangler d1 migrations list` is read-only. In the Wrangler implementation inspected during this investigation, the command initializes the migrations table before listing; it can therefore mutate the database by creating that table.
4. Do not create or populate `d1_migrations` manually based on filenames alone.
5. Do not modify Production, its D1 database, or the `main` branch.
6. Do not rename old migration files or rewrite historical SQL as part of this recovery.
7. Any schema write, ledger creation, baseline insertion, or migration execution requires a separately reviewed plan and explicit human approval.

## 4. Recommended recovery strategy

### Phase A — Freeze and preserve

- Keep the current Preview database unchanged.
- Export/backup Preview D1 before any future migration-system adoption.
- Record the database name, database ID, environment, export timestamp and current Git commit.
- Keep Production isolated and untouched.

### Phase B — Establish schema equivalence without writes

- Compare the Preview schema against the expected result of all 10 migration files.
- Compare table columns, declared types, nullability, defaults, primary keys, foreign keys, unique constraints, indexes and triggers.
- Treat missing objects, extra objects and definition differences as explicit findings.
- Do not use table existence alone as proof that a migration is fully applied.
- Inspect relevant data invariants, especially the single Owner invariant, without exposing passwords, OTPs, session tokens or other secrets.

### Phase C — Choose one migration-history strategy

**Preferred long-term option: adopt Wrangler only after a verified baseline.**

- First pin and document the Wrangler version and migration-table behavior.
- Test the exact adoption procedure on a disposable D1 database that reproduces the verified Preview schema.
- Determine the exact migration ledger schema and exact applied-file records from that Wrangler version's source/docs.
- Only after schema equivalence is established, prepare a separate, reviewable baseline operation that records the verified historical migrations as already applied.
- Do not mark a migration applied unless every effect of that exact file is present and verified.
- Run a no-op/verification rehearsal on the disposable database before touching Preview.
- Apply the baseline to Preview only after backup, independent review and explicit approval.

Because the old files reuse numeric prefixes, migration identity must be the complete filename, not only the numeric prefix. Confirm that the chosen Wrangler version supports the existing filenames and ordering. If it does not, do not rename historical files in place; use a documented compatibility strategy or a new clean migration directory after careful design.

**Alternative: retain manual SQL execution with a project-owned ledger.**

- This avoids adopting Wrangler immediately, but it requires a strict documented operator process and a custom ledger.
- Every migration must be uniquely identified by full filename and content checksum.
- The ledger update and schema change must be coordinated so partial execution cannot falsely record success.
- This approach is less desirable if the project intends to use Wrangler migrations later; do not operate both systems independently.

Do not mix manual migration execution, a custom ledger and Wrangler history without one explicitly designated source of truth.

### Phase D — Future migrations

- New migration files must have unique, monotonically increasing identifiers and descriptive names.
- Never reuse numeric prefixes.
- Never edit an already-applied migration; add a forward-only corrective migration.
- Test each migration on a disposable database first.
- Keep schema changes separate from application rollout where compatibility requires expand/migrate/contract.
- Record migration filename, checksum, Git commit, environment, operator, timestamp and verification evidence.

## 5. Go/no-go checklist before any Preview write

All must be true:

- [ ] A restorable Preview backup exists.
- [ ] The target database ID and Preview binding are independently confirmed.
- [ ] All 10 historical migrations have been compared to the actual Preview schema.
- [ ] Full table/column/index/foreign-key/trigger equivalence is documented.
- [ ] Duplicate-prefix handling is proven with the exact pinned Wrangler version, or Wrangler adoption is deferred.
- [ ] The baseline operation has been rehearsed on a disposable D1 database.
- [ ] The exact SQL/CLI operations and expected effects are reviewed.
- [ ] Independent review is complete.
- [ ] The Platform Owner explicitly approves the specific Preview write.

Production requires a separate plan and separate explicit approval. Approval for Preview does not authorize Production.

## 6. Current decision

**NO-GO for migration apply, baseline creation, migration-table creation, or any D1 write.**

Allowed now: repository documentation, static analysis, read-only schema comparison, disposable-database testing and preparation of a reviewed implementation proposal.

The next useful evidence is the full Preview `users` table definition and the remaining table definitions. These can be collected in one read-only query when convenient; no further manual work is required from the project owner until the repository-side comparison is prepared.

## 7. Change log

- 2026-11-25: Recorded the absence of migration/meta tables in the supplied Preview schema query, the 17 application-table inventory, duplicate migration prefixes, and the repository manifest's documentation-only status.
- 2026-11-25: Explicitly prohibited running Wrangler migration apply or migration listing as a presumed read-only inspection step before baseline review.
