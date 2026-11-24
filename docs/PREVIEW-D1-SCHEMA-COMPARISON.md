# Preview D1 vs Repository Migration — Static Schema Comparison

Status: Partial static comparison; no database writes performed
Branch: `feature/full-admin-panel`
Repository baseline: `0a3cf1fa34bca83a8542b4f7792ece47d26a388a`
Comparison prepared: 2026-11-25
Related plan: `docs/D1-MIGRATION-RECOVERY-PLAN.md`

## 1. Result at a glance

The object-name inventory supplied from Preview D1 matches the expected object-name inventory derived from the 10 repository migration files:

- 16 application tables expected; 16 observed.
- 17 named application indexes expected; 17 observed.
- 0 triggers expected from migrations 0001–0008; 0 observed in the supplied inventory.
- Cloudflare's `_cf_KV` is an additional system table and is not part of the application's migration inventory.

**Conclusion:** object-name-level comparison is consistent with the repository migration set. This does not prove full schema equivalence or migration execution history. Column definitions, defaults, CHECK constraints, foreign-key actions, index SQL, and data invariants have not all been compared.

## 2. Expected application tables

| Migration source | Expected tables | Preview inventory |
|---|---|---|
| 0001_admin.sql | users, sessions, login_attempts, videos, categories, settings | All six observed |
| 0004_admin_analytics.sql | analytics_events, admin_presence | Both observed |
| 0004_owner_email_otp.sql | owner_setup_otps | Observed |
| 0005_site_builder_foundation.sql | site_builder_documents, site_builder_revisions | Both observed |
| 0006_active_user_presence.sql | visitor_presence | Observed |
| 0007_user_registration.sql | user_registration_otps | Observed |
| 0007_user_restrictions_and_activity.sql | user_restrictions, user_activity_hours | Both observed |
| 0008_user_profiles.sql | user_profiles | Observed |

Expected and observed application table count: **16 / 16**.

## 3. Expected named indexes

| Migration source | Expected indexes | Preview inventory |
|---|---|---|
| 0001_admin.sql | idx_sessions_expiry, idx_login_attempts_ip_time, idx_videos_public | All observed |
| 0002_owner_roles_and_content_ownership.sql | idx_users_username, idx_videos_owner_created, idx_categories_owner_name | All observed |
| 0003_single_owner_guard.sql | idx_users_single_owner | Observed |
| 0004_admin_analytics.sql | idx_analytics_events_tab_time, idx_admin_presence_seen | Both observed |
| 0005_site_builder_foundation.sql | idx_site_builder_revisions_time | Observed |
| 0006_active_user_presence.sql | idx_visitor_presence_seen, idx_visitor_presence_user | Both observed |
| 0007_user_registration.sql | idx_user_registration_otps_ip_time, idx_user_registration_otps_expiry | Both observed |
| 0007_user_restrictions_and_activity.sql | idx_user_restrictions_expiry, idx_user_activity_hours_time | Both observed |
| 0008_user_profiles.sql | idx_user_profiles_updated | Observed |

Expected and observed named index count: **17 / 17**.

## 4. Definition-level evidence currently available

The screenshots supplied from the Cloudflare D1 Console show the following definition checks:

- `idx_users_single_owner` is a unique partial index on `users(role)` with predicate `role = 'owner'`, matching migration 0003.
- `analytics_events` and `admin_presence` creation SQL matches the corresponding migration's visible definitions.
- `owner_setup_otps` has columns `email`, `code_hash`, `expires_at`, `attempts`, `created_at`; the screenshot shows `email` as primary key, required fields and `attempts` default 0, matching migration 0004 owner OTP.
- `site_builder_documents` and `site_builder_revisions` visible definitions match the corresponding migration's columns, primary keys, foreign keys, unique revision constraint and index.
- `visitor_presence` visible definition and both named indexes match migration 0006.
- `user_registration_otps` visible creation SQL and both named indexes match migration 0007 registration.
- `user_restrictions` and `user_activity_hours` visible creation SQL and indexes match migration 0007 restrictions/activity.
- `user_profiles` visible creation SQL and its index match migration 0008.

These checks are based on the visible SQL text in the screenshots, not on a complete machine-readable export of the database schema.

## 5. Important unresolved checks

The supplied screenshots do not provide enough information to certify all definitions. Still required for a complete comparison:

1. `PRAGMA table_info('users')` and `PRAGMA table_info` for the other 15 application tables.
2. `PRAGMA foreign_key_list('<table>')` for tables with foreign keys.
3. `PRAGMA index_list('<table>')` and `sqlite_master.sql` for every index, including partial-index predicates and uniqueness.
4. Confirm whether `users.username`, `users.email_verified`, `videos.owner_id` and `categories.owner_id` match migration 0002.
5. Compare all defaults, nullability, CHECK constraints and collations, especially `user_registration_otps.email COLLATE NOCASE`.
6. Check data invariants without exposing secrets: exactly one Owner at most; foreign-key integrity; no orphaned ownership references.
7. Verify that application data was not partially or incorrectly seeded by any manual re-execution.

No row-level data dump is needed for this schema comparison. Do not share password hashes, session tokens, OTP hashes, personal profile data or email addresses.

## 6. Migration history remains unproven

The Preview query against `sqlite_master` for table names containing `migration` or `meta` returned no rows. The broader inventory did not show `d1_migrations`.

The repository's `migrations/manifest.json` is explicitly documentation-only and says Wrangler migrations are not configured. It is not proof of what was run in Preview.

The observed object names are consistent with the combined effects of migrations 0001–0008. They do not establish:
- which exact files were executed;
- whether both duplicate-prefix migration files were run;
- whether SQL was pasted manually or executed by Wrangler;
- whether a migration partially failed and was later repaired manually;
- whether the current objects were altered after creation.

## 7. Risk notes

- `0002_owner_roles_and_content_ownership.sql` includes non-idempotent `ALTER TABLE ... ADD COLUMN` statements.
- Re-running historical migrations can fail or create inconsistent partial results.
- The duplicate numeric prefixes in 0004 and 0007 make numeric-only migration identity unsafe.
- Do not run `wrangler d1 migrations apply` until a verified migration baseline is designed and rehearsed.
- Do not use `wrangler d1 migrations list` as a guaranteed read-only inspection. The Wrangler source version inspected in this project investigation initializes its migrations table before listing.
- Do not create or populate a migration ledger based on table-name matching alone.

## 8. Decision

**Object-name inventory: PASS (16/16 tables, 17/17 indexes).**

**Partial visible-definition checks: PASS for the specific objects listed in Section 4.**

**Full schema equivalence: NOT YET CERTIFIED.**

**Migration history: UNKNOWN / NOT RECORDED IN THE INSPECTED SCHEMA.**

**Database write authorization: NOT GRANTED.**

Next step should be a single consolidated read-only schema export or the remaining targeted PRAGMA results. No D1 write is justified by the current evidence.
