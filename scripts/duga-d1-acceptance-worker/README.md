# DUGA disposable D1 acceptance Worker

This is an isolated, test-only Worker. It is not part of the app and must never be deployed with the production Pages project.

## Fixed target

> **Target identity warning — legacy v1 configuration.** This directory's checked-in `wrangler.toml` is pinned to `drm-duga-acceptance-disposable` / `6d512429-34a3-498b-9430-45f11d382da9`. The revised gap-probe SQL targets a separate v2 database, `drm-duga-acceptance-v2-disposable` / `716a4f20-25a5-4a59-9dd2-c764b193f385`. Running `wrangler deploy` from this directory does **not** target v2. Do not deploy this project or run the revised probes until the owner explicitly authorizes the disposable-D1 test and the Worker/database identity is reconciled. See [DUGA D1 Target Registry](../../docs/DUGA-D1-TARGET-REGISTRY.md).

- Database name: `drm-duga-acceptance-disposable`
- Database ID: `6d512429-34a3-498b-9430-45f11d382da9`
- D1 binding: `DB`

The Wrangler file pins the disposable database ID. Before any deployment, visually confirm the same name and ID in Cloudflare. Do not change the binding to Production or shared Preview.

## What it tests

A single authenticated `POST /run` executes the proposed two-statement D1 batch pattern and returns each statement's individual `meta.changes`:

1. Valid CAS transition: 1 update / 1 audit insert.
2. Stale expected version: 0 / 0.
3. Replay original transition token: 0 / 0.
4. Reuse an already-audited token against a later expected version: 0 / 0.
5. Force the audit INSERT CHECK constraint to fail; confirm the batch rejects and the state row rolls back.
6. Two concurrent writers with distinct tokens and the same expected version; exactly one should win and exactly one audit row should exist.
7. Confirm one audit event exists for the successful token.

The Worker creates uniquely named synthetic change requests and one synthetic user row. Test rows and audit events are intentionally retained because the audit table is append-only. Repeated runs create fresh IDs.

## Recorded owner-operated run and limitation

Draft PR #4 records an owner-operated deployment and authenticated run on 2026-11-25:
- Worker: `duga-d1-acceptance-disposable`
- Pinned disposable D1 ID: `6d512429-34a3-498b-9430-45f11d382da9`
- Run ID: `53d70371-008c-46a0-8bc3-33522be990eb`
- Completion: `2026-11-25T01:04:19.420Z`
- Recorded aggregate result: PASS

The run was against the disposable database, not the Pages shared Preview or Production database. The assisting model did not operate the Cloudflare deployment or independently inspect the account; this is owner-operated evidence recorded in PR #4. The saved PowerShell output showed the aggregate PASS, not every nested per-case count.

**This PASS predates the latest schema additions** for `parent_change_request_id`, its immutable-link trigger, and the AI-review terminal-rejection guard. It is not acceptance evidence for the current final schema. Re-run the full Worker suite against a freshly created disposable database using the current fixture before considering any shared Preview migration.

No Cloudflare resource, binding, secret, or deployment was changed by the repository documentation/test-script updates in this continuation.

## Repeat-run gate

Before any redeployment, reconfirm the Worker name and pinned database ID in Cloudflare. Never point this Worker at the Pages Preview or Production D1 database, and never deploy it through the Pages project.

Use a separate Wrangler project directory and a strong one-off `ACCEPTANCE_SECRET` stored only as a Worker secret. Never commit or share the secret. Call only authenticated `POST /run`, save the complete JSON response, and verify each nested case—not only the aggregate `pass`. Remove the Worker and its secret only when the owner authorizes cleanup.

Do not treat this test Worker as production code or an authorization implementation.
