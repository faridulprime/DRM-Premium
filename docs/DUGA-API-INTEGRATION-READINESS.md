

## 14. Shared Preview D1 preflight — owner-supplied Console evidence (2026-11-25)

The owner supplied Cloudflare D1 Console screenshots from the database labeled `drmdatabase-preview`. Read-only observations:

- Existing application tables include `users`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `videos`, and `visitor_presence`.
- The visible `users` schema has `id TEXT PRIMARY KEY`; its role column defaults to `admin`. This is type-level compatibility evidence for DUGA human-user foreign keys referencing `users(id)`, not proof of complete application compatibility.
- The migration/meta table name search returned no rows; this does not establish that no migration ledger or other migration mechanism exists.
- The `duga_%` object search returned no rows.
- `PRAGMA foreign_key_check;` completed with no violation rows shown.
- `PRAGMA foreign_keys;` returned `1` in the Console session.

Qualification: these are screenshots supplied by the owner, not independent account access. The database UUID and the deployed Worker's Preview binding-to-database mapping have not been established by this evidence. The index screenshot is incomplete and does not certify a complete inventory or exact index count. No schema or data changes were made; all observed queries were read-only.

### Updated Go / No-Go

The preflight confirms a clean reported FK check and enabled FK enforcement in the Console session, but it does not resolve the migration-history gap or establish the exact binding identity. The current Preview inventory contains no `duga_%` objects. The schema remains design-only.

**Decision remains NO-GO for Preview migration rollout and DUGA write endpoints.** Before reconsideration, confirm the Preview D1 UUID and Worker binding, reconcile the actual migration ledger and repository migration files, obtain complete schema/index/trigger inventory, independently review the migration plan, and complete trusted service identity and application integration tests. Do not infer that an empty name-filtered metadata query means the database has never been migrated.


## 14. Shared Preview D1 preflight — owner-supplied Console evidence (2026-11-25)

The owner supplied Cloudflare D1 Console screenshots from the database labeled `drmdatabase-preview`. Read-only observations:

- Existing application tables include `users`, `user_profiles`, `user_registration_otps`, `user_restrictions`, `videos`, and `visitor_presence`.
- The visible `users` schema has `id TEXT PRIMARY KEY`; its role column defaults to `admin`. This is type-level compatibility evidence for DUGA human-user foreign keys referencing `users(id)`, not proof of complete application compatibility.
- The migration/meta table name search returned no rows; this does not establish that no migration ledger or other migration mechanism exists.
- The `duga_%` object search returned no rows.
- `PRAGMA foreign_key_check;` completed with no violation rows shown.
- `PRAGMA foreign_keys;` returned `1` in the Console session.

Qualification: these are screenshots supplied by the owner, not independent account access. The database UUID and the deployed Worker's Preview binding-to-database mapping have not been established by this evidence. The index screenshot is incomplete and does not certify a complete inventory or exact index count. No schema or data changes were made; all observed queries were read-only.

### Updated Go / No-Go

The preflight confirms a clean reported FK check and enabled FK enforcement in the Console session, but it does not resolve the migration-history gap or establish the exact binding identity. The current Preview inventory contains no `duga_%` objects. The schema remains design-only.

**Decision remains NO-GO for Preview migration rollout and DUGA write endpoints.** Before reconsideration, confirm the Preview D1 UUID and Worker binding, reconcile the actual migration ledger and repository migration files, obtain complete schema/index/trigger inventory, independently review the migration plan, and complete trusted service identity and application integration tests. Do not infer that an empty name-filtered metadata query means the database has never been migrated.
