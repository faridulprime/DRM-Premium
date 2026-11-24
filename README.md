# DRM- Premium

Static Cloudflare Pages site with a D1-backed content API and a protected management panel.

## Development branch

All current work is on `feature/full-admin-panel`. Production `main` has not been changed by this work. Review and test the branch preview before merging.

## Current management features

- A single protected Owner role, established through first-time bootstrap.
- Admin role is separate from Owner.
- Admins can list, create, edit and delete only videos they own.
- Admins can create, rename and delete only categories they own.
- A video can only be assigned to a category owned by that Admin. Owner can manage all categories and videos.
- Owner-only website settings.
- Owner-only user/role management. Owner can promote a verified user to Admin or revoke that Admin role.
- Removing an Admin revokes their sessions and demotes the account to User. Their content is retained; Owner continues to control it.
- Passwords use PBKDF2-HMAC-SHA-256 with a unique random salt per account and 100,000 iterations.
- Sessions use random opaque tokens stored as SHA-256 hashes in D1, with HttpOnly, Secure and SameSite=Strict cookies; session lifetime is seven days.
- Login throttling: up to 8 failed attempts per IP hash in a 15-minute window.
- Mutating API requests require a matching same-origin Origin header.
- Authorization is enforced in the API/database queries, not only by hiding dashboard controls.

## Cloudflare setup

The management API requires the D1 database binding and encrypted secrets.

1. Cloudflare Pages project `drm-premium` → Settings → Bindings → D1 database.
2. Keep the existing Production database `drmdatabase` untouched. Create a separate D1 database named `drmdatabase-preview` and bind it as `DB` in the Preview environment only. Do not point Preview at the Production database.
3. For a **brand-new, empty Preview database only**, open its D1 Console and execute the SQL files individually, in this exact order:
   - `migrations/0001_admin.sql`
   - `migrations/0002_owner_roles_and_content_ownership.sql`
   - `migrations/0003_single_owner_guard.sql`
   - `migrations/0004_admin_analytics.sql`
   - `migrations/0004_owner_email_otp.sql`
   - `migrations/0005_site_builder_foundation.sql`
   - `migrations/0006_active_user_presence.sql`
   - `migrations/0007_user_registration.sql`
   - `migrations/0007_user_restrictions_and_activity.sql`
   - `migrations/0008_user_profiles.sql`
   
   Both files sharing prefix `0004` and both files sharing prefix `0007` are required. The complete inventory and dependency notes are in [`migrations/manifest.json`](migrations/manifest.json). Run one file at a time and inspect the result before continuing.
4. Create a free Google Apps Script project and paste `google-apps-script/Code.gs` into its editor.
   - In Project Settings → Script Properties, add `DRM_OTP_TOKEN` (a long random value) and `OWNER_EMAIL` (the same Owner email).
   - Deploy → New deployment → Web app. Execute as **Me**; access: **Anyone**. Authorize Gmail sending when prompted and copy the Web app URL ending in `/exec`.
5. Pages project → Settings → Variables and Secrets. Add encrypted secrets in the **Preview** environment:
   - `OWNER_EMAIL`: the one email address allowed to create the single Owner account.
   - `GOOGLE_APPS_SCRIPT_URL`: the Apps Script Web app `/exec` URL.
   - `GOOGLE_APPS_SCRIPT_TOKEN`: exactly the same random value saved as Apps Script property `DRM_OTP_TOKEN`.
   - `SESSION_SECRET`: a separate random secret, at least 32 random characters.
6. Deploy the `feature/full-admin-panel` branch to a Preview URL.
7. Open the Preview `/admin`. Enter the Owner email (must match `OWNER_EMAIL`), username, a password of at least **8 characters**, request the email code, then enter the 6-digit code to create the Owner account.
8. Test Owner and Admin permissions using separate test accounts before merging.

Never commit secrets to GitHub or send them in chat/screenshots. Use Cloudflare encrypted secrets only. Do not use a password previously shared in chat.

## D1 migrations

The complete migration inventory, fresh-database execution order, dependencies and known filename-prefix collisions are recorded in [`migrations/manifest.json`](migrations/manifest.json). The manifest is documentation only: it is not a Wrangler migrations configuration and does not record applied state.

For a brand-new empty database, apply all ten SQL files individually in the order listed in the Cloudflare setup section above. Both `0004` files and both `0007` files are required. The `0002` migration promotes the earliest existing account to Owner; review that behavior before using it on a database with existing users.

**Existing database warning:** Do not rerun these files against an existing Preview or Production database. A schema inspection that finds the expected tables does not prove which migration files ran or in what order. The current Preview preflight found no migration/meta table, so its historical migration ledger is unverified. Do not run `wrangler d1 migrations apply` or create a synthetic migration baseline until the database has been backed up and its complete schema/data state has been reconciled against a fresh-install test. Keep D1 backups/exports before any schema change.

## Important implementation status / limitations

- Public account registration is implemented as a two-step email-verified flow. The required `user_registration_otps` table is created by `migrations/0007_user_registration.sql` in the fresh-database sequence above. Before enabling registration on an existing database, verify that table exists; do not rerun the migration if it is already present. New public accounts are created with the `user` role only; Owner/Admin privileges remain Owner-controlled.
- Google Authenticator (TOTP), SMS OTP, password reset and email-based account recovery are not implemented yet.
- The initial Owner setup verifies the configured Owner email with a one-time code sent through Gmail using the Google Apps Script mailer; no Owner password, OTP, or mailer token is stored in source code.
- Direct binary image upload is not included; the current site accepts HTTPS image URLs.
- Admin content ownership currently covers videos and categories. Article, reference and folder content types need their own owner_id schema/API before those features are enabled.
- Website Builder foundation: Owner-only draft/state/history API, schema-validated JSON documents, optimistic revision conflict checks and a 30-day revision timeline. The visual editing UI, live renderer, publish pipeline and media management are not yet implemented; `/api/builder/state` explicitly reports `publishEnabled: false` until that work is complete.
- Dashboard tab-view analytics, online Admin presence and video post counts are implemented. Analytics currently records main navigation tab visits; it does not yet measure unique visitors or detailed engagement.
- Use YouTube videos you own or are authorized to embed. Unlisted links are not access-controlled.

## Site identity

The public-facing product name is DRM- Premium. The current UI still has a few legacy FRAME labels that will be updated in the public-site redesign.

## Governance foundation (DUGA)

DUGA is being introduced as a separate governance layer. Its initial Foundation scope is documentation and version-controlled governance metadata only; it does not replace the existing Owner/Admin/User authorization or become a runtime dependency of the public website.

- [DUGA architecture](docs/DUGA-SPEC.md)
- [DUGA implementation plan](docs/DUGA-IMPLEMENTATION-PLAN.md)
- [Repository audit baseline](docs/DUGA-REPOSITORY-BASELINE.md)
- [System registry](governance/registry/systems.json)
- [Ownership and roles](governance/ownership/)
- [Dependency baseline](governance/dependencies/systems.json)
- [AI onboarding entry point](docs/AI-CONTINUITY/MASTER-ONBOARDING.md)

The D1 governance schema, APIs, Control Center UI and executable Deep Cleaner are not implemented by this foundation stage. Keep Preview and Production databases isolated; do not apply a governance migration to Production without a separately approved change.
