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
- Passwords use PBKDF2-HMAC-SHA-256 with a unique random salt per account and 210,000 iterations.
- Sessions use random opaque tokens stored as SHA-256 hashes in D1, with HttpOnly, Secure and SameSite=Strict cookies; session lifetime is seven days.
- Login throttling: up to 8 failed attempts per IP hash in a 15-minute window.
- Mutating API requests require a matching same-origin Origin header.
- Authorization is enforced in the API/database queries, not only by hiding dashboard controls.

## Cloudflare setup

The management API requires the D1 database binding and encrypted secrets.

1. Cloudflare Pages project `drm-premium` → Settings → Bindings → D1 database.
2. Keep the existing Production database `drmdatabase` untouched for now. Create a separate D1 database named `drmdatabase-preview` and bind it as `DB` in the Preview environment only. Do not point Preview at the Production database.
3. In the `drmdatabase-preview` Console, run `migrations/0001_admin.sql` once.
4. Then run `migrations/0002_owner_roles_and_content_ownership.sql` once.
5. Then run `migrations/0003_single_owner_guard.sql` once. This adds a database-level unique constraint so only one Owner can exist.
6. Pages project → Settings → Variables and Secrets. Add encrypted secrets:
   - `OWNER_EMAIL`: the one email address allowed to create the single Owner account.
   - `RESEND_API_KEY`: an API key from Resend with permission to send email.\n   - `RESEND_FROM`: a sender address verified in Resend, e.g. `DRM Premium <verify@your-verified-domain>`.
   - `SESSION_SECRET`: a separate random secret, at least 32 random characters.
7. Deploy the `feature/full-admin-panel` branch to a Preview URL.
8. Open the preview `/admin`. Enter the Owner email (must match `OWNER_EMAIL`), desired username, a new password of at least 12 characters, and the Bootstrap Secret.
9. After Owner setup succeeds, remove `BOOTSTRAP_SECRET` from the Preview environment. Keep `OWNER_EMAIL` and `SESSION_SECRET`. Do not change Production secrets or bindings yet.
10. Test Owner and Admin permissions using separate test accounts before merging.

Never commit secrets to GitHub or send them in chat/screenshots. Use Cloudflare encrypted secrets only. Do not use a password previously shared in chat.

## D1 migrations

The first migration creates the original users, sessions, login-attempt throttling, videos, categories and settings tables, plus sample content.

The second migration adds usernames, email-verification state, Owner role and content ownership columns. It promotes the first existing account to Owner. If the Owner is created after migration, the bootstrap endpoint assigns any legacy unowned content to that Owner.

Run each migration only once per database, in numerical order. Keep D1 backups/exports before applying schema changes to a database containing important data.

## Important implementation status / limitations

- Public account registration and email-verification delivery are not implemented yet. The Owner can only promote an existing verified User once registration/verification is added. Until then, the Owner role controls are not yet a complete public onboarding flow.
- Google Authenticator (TOTP), SMS OTP, password reset and email-based account recovery are not implemented yet.
- The initial Owner setup verifies the configured Owner email with a one-time code sent through Resend; no Owner password or OTP is stored in source code.
- Direct binary image upload is not included; the current site accepts HTTPS image URLs.
- Admin content ownership currently covers videos and categories. Article, reference and folder content types need their own owner_id schema/API before those features are enabled.
- Dashboard activity/online indicators and upload-count analytics are not implemented yet.
- Use YouTube videos you own or are authorized to embed. Unlisted links are not access-controlled.

## Site identity

The public-facing product name is DRM- Premium. The current UI still has a few legacy FRAME labels that will be updated in the public-site redesign.
