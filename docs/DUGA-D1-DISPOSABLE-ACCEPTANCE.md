

## 12. Shared Preview D1 read-only preflight — 2026-11-25

The owner supplied Cloudflare D1 Console screenshots from the database labeled `drmdatabase-preview`. The screenshots show the following read-only observations:

- The schema inventory includes existing application tables such as `users`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `videos`, and `visitor_presence`.
- The `users` table definition shown is `id TEXT PRIMARY KEY`, `email TEXT NOT NULL UNIQUE COLLATE NOCASE`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL DEFAULT 'admin'`, `created_at INTEGER NOT NULL`, nullable `username`, and `email_verified INTEGER NOT NULL DEFAULT 1`.
- The migration/meta table discovery query returned no rows.
- The `duga_%` object discovery query returned no rows.
- The index inventory includes application indexes and SQLite-generated autoindexes; the supplied screenshot is not a complete enough capture to certify the exact total or every definition.
- `PRAGMA foreign_key_check;` completed successfully and displayed no violation rows.
- `PRAGMA foreign_keys;` returned `1` in the Console session, indicating foreign-key enforcement was enabled for that session.

Evidence qualification: these are owner-supplied Console screenshots, not independently accessed Cloudflare account data. The database label is visible as `drmdatabase-preview`; the screenshot does not establish the D1 database UUID or conclusively prove the Worker binding points to this exact database. Record the UUID/binding mapping separately before any migration planning.

The empty migration/meta-name search does not prove that no migration mechanism exists: it only shows that no table matched the supplied name filters. The exact migration ledger and deployment history still require reconciliation with repository migrations and Wrangler/Cloudflare configuration.

This preflight was read-only. No schema/data change, migration, binding change, deployment, or Production action was performed. No DUGA objects were present in the supplied Preview inventory. The DUGA schema remains a design draft, not a migration. **Preview migration rollout and DUGA write endpoints remain NO-GO** pending exact database identity/binding confirmation, complete migration-history reconciliation, full schema/index/trigger comparison, independent review, trusted service identity, and application integration tests.
