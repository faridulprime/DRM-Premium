# DUGA D1 Target Registry

Date: 2026-11-25  
Branch: `duga-foundation-review`  
Purpose: prevent the test Worker, manual probes, shared Preview and Production database identities from being confused.

## Recorded database targets

| Environment / artifact | Database name | Database ID | Evidence and status |
|---|---|---|---|
| Pages Preview | `drmdatabase-preview` | `6821a135-9330-4537-9cf8-eb9ca90970b8` | Owner-supplied Cloudflare screenshots recorded in `DUGA-API-INTEGRATION-READINESS.md`. **NO-GO** for migration rollout. |
| Pages Production | `drmdatabase` | Not recorded in this repository evidence | Owner-supplied screenshot shows a distinct binding from Preview. **Never a test target.** |
| Disposable v1 Worker in checked-in Wrangler config | `drm-duga-acceptance-disposable` | `6d512429-34a3-498b-9430-45f11d382da9` | `scripts/duga-d1-acceptance-worker/wrangler.toml` and its README. Its recorded aggregate PASS predates the parent-link and AI-review guard additions; it is not final-schema acceptance. |
| Disposable v2 revised gap-probe target | `drm-duga-acceptance-v2-disposable` | `716a4f20-25a5-4a59-9dd2-c764b193f385` | Literal target in `scripts/duga-d1-revised-gap-probes.sql`; readiness notes record an owner-supplied screenshot of a separately deployed v2 Worker/binding. The v2 ID is recorded from the repository probe file, not independently re-read from the Cloudflare account in this review. |

## Identity reconciliation result

The checked-in v1 Worker configuration and the revised v2 gap-probe SQL intentionally refer to two different disposable D1 IDs. They are not interchangeable.

- Running `wrangler deploy` from `scripts/duga-d1-acceptance-worker/` targets **v1** (`6d512...`), not v2.
- Running `scripts/duga-d1-revised-gap-probes.sql` is intended for **v2** (`716a...`) and must not be pointed at the v1, Preview or Production database.
- The owner-supplied readiness evidence describes a deployed v2 Worker, but the current checked-in `wrangler.toml` does not describe that v2 Worker. Do not infer that the repository's v1 config matches the deployed v2 binding.
- No current final-schema D1 acceptance result is recorded. The older v1 aggregate PASS predates the latest parent-link and AI-review guard changes.

## Required gate before a revised-schema D1 run

1. Obtain explicit owner approval for the disposable-D1 operation.
2. Reconfirm the v2 database name and ID in the Cloudflare dashboard/Console; do not rely solely on this repository string.
3. Reconcile or create a separate v2 Worker project with an explicit `DB` binding to that exact v2 ID. Keep the v1 Worker directory and its config unchanged until separately authorized.
4. Verify the one-off Worker secret is configured without exposing or committing it.
5. Apply the fixture only to the confirmed new disposable database, run the complete Worker suite, save the full response and per-case counts, and execute the revised gap probes.
6. Remove test Worker/secret or test data only with explicit owner approval; audit rows are append-only.

## Scope and limitations

This registry is a repository-source consistency record. It does not read Cloudflare account state, prove a current deployed binding, authorize deployment, or constitute D1 acceptance. Pages Preview remains NO-GO until the migration ledger, full schema/index/trigger inventory, backup and recovery plan, and independent review are reconciled.
