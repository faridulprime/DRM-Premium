


## 14. Shared Preview D1 preflight — owner-supplied Console evidence (2026-11-25)

The owner supplied screenshots showing:
- Cloudflare D1 database list: `drmdatabase-preview`, UUID `6821a135-9330-4537-9cf8-eb9ca90970b8`.
- Pages project `drm-premium`, Preview environment: D1 binding name `DB` points to the database labeled `drmdatabase-preview`.
- Pages project `drm-premium`, Production environment: D1 binding name `DB` points to `drmdatabase` (distinct from Preview).
- The isolated acceptance Worker `duga-d1-acceptance-v2-disposable` has a separate Production binding `DB` pointing to `drm-duga-acceptance-v2-disposable`; this is not the Pages Preview database.

Read-only observations from the Preview D1 Console:
- Existing application tables include `users`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `videos`, and `visitor_presence`.
- The visible `users` schema has `id TEXT PRIMARY KEY`; its role column defaults to `admin`.
- The migration/meta table name search returned no rows; this does not prove no migration ledger or other migration mechanism exists.
- The `duga_%` object search returned no rows.
- `PRAGMA foreign_key_check;` completed with no violation rows shown.
- `PRAGMA foreign_keys;` returned `1` in the Console session.

Evidence qualification: these are owner-supplied screenshots, not independent access to the Cloudflare account. The database-list UUID and Pages Preview binding label match, which is strong configuration evidence for the Preview DB target. A screenshot does not prove every deployed Pages version has the same runtime binding, nor does it expose migration history beyond the query results. No schema/data changes, migrations, binding changes, deployments, or Production actions were performed.

### Updated Go / No-Go

The Preview D1 UUID is now recorded as `6821a135-9330-4537-9cf8-eb9ca90970b8`, and the Pages Preview `DB` binding label matches `drmdatabase-preview`. The Pages Production `DB` binding is separately labeled `drmdatabase`. The disposable acceptance Worker remains separately bound to the disposable database.

**Decision remains NO-GO for Preview migration rollout and DUGA write endpoints.** The Preview inventory has no `duga_%` objects and the migration/meta-name query returned no rows, but the actual migration ledger and repository migration sequence still require reconciliation. Complete schema/index/trigger inventory, independent migration review, trusted service identity, and application integration tests remain outstanding. Do not infer that an empty name-filtered metadata query means the database has never been migrated.
