# DUGA disposable D1 acceptance Worker

This is an isolated, test-only Worker. It is not part of the app and must never be deployed with the production Pages project.

## Fixed target

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

## Important limitation

This Worker source has not been deployed or run against D1 from this session. A successful local CI run is not D1 runtime evidence. No Cloudflare resource, binding, secret, or deployment has been changed by adding these files.

## Manual deployment gate (owner-operated)

Do not proceed until the owner explicitly approves deploying this separate Worker to the pinned disposable D1 database. Never deploy through the existing Pages project.

After approval, use a separate Wrangler project directory and configure a strong one-off `ACCEPTANCE_SECRET` as a Worker secret. Never put that secret in source control or chat. Then deploy only this Worker and call `POST /run` with the matching bearer token. Save the full JSON response as acceptance evidence. Remove the Worker and its secret after evidence capture if the owner authorizes cleanup.

Do not treat this test Worker as production code or an authorization implementation.
