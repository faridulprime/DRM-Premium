# FRAME — Netflix-style YouTube video library

## Secure Admin CMS
- Public site: /
- Admin panel: /admin (rewritten to admin.html)
- API: /api/*
- D1 migration: migrations/0001_admin.sql
- Features: YouTube video add/edit/delete/publish, category create/rename/delete, homepage title/text/image/color and hero/library visibility, multiple admin accounts.
- Passwords use PBKDF2-HMAC-SHA-256 with a unique random salt per account and 210,000 iterations.
- Sessions use random opaque tokens stored as SHA-256 hashes in D1, with HttpOnly, Secure and SameSite=Strict cookies; session lifetime is seven days.
- Login throttling: up to 8 failed attempts per IP hash in a 15-minute window.
- Mutating API requests require a matching same-origin Origin header.
- All new work is on branch `feature/full-admin-panel`; the live `main` branch has not been modified.

## Required Cloudflare setup (the Admin Panel will not function until these steps are completed)
1. Create a Cloudflare D1 database, for example `frame-db`.
2. Open the existing Pages project `drm-premium` (your live site) → Settings → Functions → D1 database bindings.
3. Add a binding with variable name `DB` and select the new D1 database. Bind it in both Production and Preview environments if you will test the feature branch preview before merging.
4. Open the selected D1 database → Console. Run the complete SQL from `migrations/0001_admin.sql` once.
5. Pages project → Settings → Variables and Secrets. Add encrypted secrets:
   - `BOOTSTRAP_SECRET`: one-time random secret, at least 32 random characters.
   - `SESSION_SECRET`: a separate random secret, at least 32 random characters.
   Do not use the same value for both.
6. Redeploy the relevant Pages deployment after the binding and secrets are saved.
7. Open `/admin`. On first setup, enter the Bootstrap Secret, your admin email, and a password of at least 12 characters.
8. Once the first Admin account is created, remove `BOOTSTRAP_SECRET` from Pages secrets. Keep `SESSION_SECRET` configured.
9. Log in again at `/admin`.

Never commit secrets to GitHub or send them in chat/screenshots. Use Cloudflare encrypted secrets only.

## D1 setup SQL
The migration creates users, sessions, login-attempt throttling, videos, categories and website settings, and inserts three starter videos. Run it once in the D1 Console. If you run it again, the `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE` statements are safe, but it does not reset existing content.

## Important limitations and security notes
- This first version accepts HTTPS image URLs; direct image binary upload/storage is not included.
- Every account created in Admin Accounts is a full administrator. Only add trusted people.
- Removing an Admin ends their active sessions; the current Admin and the last remaining Admin cannot remove themselves.
- Password reset/email invitation flows are not included. A new Admin's temporary password must be shared securely outside the website and changed through a separate process (not yet implemented).
- Arrange D1 exports/backups before relying on this for important content.
- Use YouTube videos you own or are authorized to embed. Unlisted links are not access-controlled.
