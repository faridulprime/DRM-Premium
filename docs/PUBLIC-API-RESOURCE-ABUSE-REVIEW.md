# Public API Resource-Abuse Review

Date: 2026-11-25  
Target ref: `feature/full-admin-panel`  
Review mode: repository source inspection only

## Scope and limits

This review covers the Pages API catch-all and the client code that calls the public presence and analytics write endpoints. It is not a penetration test, traffic study, Cloudflare zone audit, or Production runtime test. The Cloudflare account's WAF, bot-management, and rate-limit configuration was not available to inspect.

No runtime API handler, D1 schema, Cloudflare setting, binding, or database was changed as part of this review.

## Endpoint findings

### `POST /api/presence`

The handler runs before the authenticated-user gate and supports both sessions and guest visitor cookies.

| Request type | Observed D1 statements per heartbeat | Purpose |
|---|---:|---|
| Signed-in visitor | 4 | Upsert activity-hour row; clean old activity rows; upsert visitor presence; clean stale presence rows |
| Guest visitor | 2 | Upsert visitor presence; clean stale presence rows |

The public app, Admin and Live Users clients send the public heartbeat every 30 seconds. Admin and Live Users also send an authenticated `/api/admin/presence` heartbeat every 30 seconds. That endpoint performs two D1 statements: upsert the authenticated administrator's presence row and delete stale admin-presence rows.

For an active Owner session on the Admin page, the inspected client timer sends both public and admin-presence heartbeats and also refreshes Admin analytics. The source therefore issues approximately 11 D1 statements per 30-second cycle: 4 public presence + 2 admin presence + 5 Admin analytics (one stale-row cleanup and four aggregate/read queries). This is a source-derived statement count, not a measured Production cost or billing figure; other page actions and requests are excluded.

The Live Users page refreshes its active-user list every 15 seconds. The corresponding owner-only endpoint performs a stale-presence cleanup and an active-row query (two D1 statements per refresh). These recurring actions should be included when measuring normal Admin/Live Users traffic before setting edge quotas.

The `visitor_presence(last_seen)` and `admin_presence(last_seen)` indexes support the associated stale-row cleanup queries. They do not remove the need to meter abusive request volume.

### `POST /api/analytics/event`

The handler accepts only a fixed set of tab names and then inserts one row into `analytics_events` for each accepted request.

No route-local per-IP quota, authenticated-session quota, or duplicate-event suppression was found in this handler. The Admin frontend records an event when a tab is activated; the homepage sends an event from its navigation handler. The migration adds an index on `(tab, created_at)`, but the Admin analytics endpoint aggregates `COUNT(*) GROUP BY tab` over stored event history without a time predicate.

No retention or deletion path for `analytics_events` was found in the inspected repository source. This does not exclude cleanup by an external scheduler, D1 task, or another service outside the repository. As the event table grows, the lifetime aggregate can require increasing index/table work even though the grouping index exists.

## Existing controls and their boundaries

- The shared mutation guard requires an `Origin` header equal to the request URL's origin and requires JSON content type. This is an origin/CSRF check, not a rate limiter; a direct client can send an Origin header.
- The shared `readBody(req)` checks whether the declared `Content-Length` exceeds 20,000 bytes, then calls `req.json()`. It does not count bytes as the request stream is consumed. When `Content-Length` is absent or inaccurate, this guard alone is not a strict streaming-byte limit. This reader is used by analytics and most JSON API routes, including the Builder style PUT route.
- The Builder draft PUT route uses a separate `readBuilderBody(req)`: it checks declared length and then measures actual UTF-8 body bytes against 250,000 bytes before JSON parsing. The Profile PUT route similarly checks declared length and actual body bytes against 2,900,000 bytes. These route-specific controls do not change the behavior of the shared `readBody(req)`.
- Registration OTP has a per-email 60-second resend interval and a limit of five requests per IP hash over 15 minutes. OTP verification also caps incorrect attempts at five per stored email challenge. These controls do not protect presence or analytics.
- Login has a separate limit of eight failed attempts per IP hash over 15 minutes. The handler deletes stale login-attempt rows on each login request and clears that IP hash's attempts after a successful login. This does not protect presence or analytics.
- Initial Owner OTP has a global 60-second resend interval based on the latest stored challenge. It is not a general per-IP quota.
- The repository's `_headers` file contains response security headers. It does not contain Cloudflare WAF/rate-limit policy.
- The inspected source has no route-local per-IP or per-session meter for the presence or analytics endpoints. Cloudflare's edge configuration remains unknown.

## Risk classification

**Status: edge verification required; not a confirmed exploit.**

The code demonstrates that unauthenticated callers can reach endpoints that write to D1. It does not establish whether Cloudflare currently applies appropriate limits, whether abnormal traffic has occurred, or what normal traffic volume looks like.

## Recommended order of work

1. Inspect the deployed Cloudflare zone/Pages security rules and existing rate-limit policies for both paths. Capture the exact rules, methods, thresholds, action, and scope.
2. Measure legitimate traffic, including the 30-second heartbeat, page reloads, Admin/Live Users activity, multiple tabs, and users behind shared NAT.
3. Set endpoint-specific edge limits with burst headroom based on measured usage. Do not invent thresholds before this baseline exists.
4. Decide whether analytics should deduplicate repeated tab events by visitor/session and a bounded time window.
5. Define the analytics retention period and whether old raw events should be rolled up into aggregates before deletion.
6. Revisit `readBody(req)` with a bounded stream-reading implementation and tests for missing, false, and oversized Content-Length headers.
7. Add regression tests for legitimate heartbeat cadence, burst traffic, shared-IP clients, Origin spoofing by non-browser clients, analytics duplication, and oversized bodies.

## Change gate

Changes to live request behavior, D1 schema, Cloudflare rules, or retention data operations require a separate regression plan and the applicable owner approval. No such change was made during this source review.
## Follow-up source audit — 2026-11-25

This update distinguishes the stronger body readers used by Builder draft PUT and Profile PUT from the shared header-length-only JSON reader. It also records the existing per-IP login and OTP quotas, which are separate from presence/analytics and do not protect those write endpoints.

The active Owner Admin-page cadence is source-estimated at approximately 11 D1 statements per 30 seconds (4 public presence + 2 admin presence + 5 Admin analytics) before other page actions. Live Users additionally polls its active-user list every 15 seconds. These are code-path counts, not Production traffic measurements. No retention/roll-up/deletion path for the analytics event history was found in the inspected repository.

No runtime API handler, D1 schema, Cloudflare setting, binding, or database was changed in this follow-up.
