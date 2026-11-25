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

The frontend heartbeat interval is 30 seconds in the public app, Admin, and Live Users implementations. This normal cadence must be preserved when setting any future rate limit. A blanket low request threshold could block ordinary users, especially multiple people sharing one public IP address.

The presence table has an index on `last_seen`, which supports its stale-row cleanup query. This does not remove the need to meter abusive request volume.

### `POST /api/analytics/event`

The handler accepts only a fixed set of tab names and then inserts one row into `analytics_events` for each accepted request.

No route-local per-IP quota, session quota, or duplicate-event suppression was found in the handler. The Admin frontend records an event when a tab is activated; the homepage sends an event from its navigation handler. The migration adds an index on `(tab, created_at)`.

No retention or deletion path for `analytics_events` was found in the inspected Pages catch-all API source. This finding does not exclude cleanup by an external scheduler, D1 task, or another service not present in the inspected source.

## Existing controls and their boundaries

- The shared mutation guard requires an `Origin` header equal to the request URL's origin and requires JSON content type. This is an origin/CSRF check, not a rate limiter; a direct client can send an Origin header.
- `readBody(req)` checks whether the declared `Content-Length` exceeds 20,000 bytes, then calls `req.json()`. It does not count bytes as the request stream is consumed. When Content-Length is absent or inaccurate, this guard alone is not a strict streaming-byte limit.
- Registration OTP has a per-email 60-second resend interval and a limit of five requests per IP hash over 15 minutes. These controls apply to the OTP route only; they do not protect presence or analytics.
- The repository's `_headers` file contains response security headers. It does not contain Cloudflare WAF/rate-limit policy.
- The inspected source has no route-local per-IP meter for either endpoint. Cloudflare's edge configuration remains unknown.

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
