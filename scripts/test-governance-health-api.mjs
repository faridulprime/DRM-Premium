#!/usr/bin/env node
/**
 * Integration-style tests for the DUGA health, change listing/detail and audit routes.
 * Loads the Pages handler as an ES module and supplies a minimal in-memory D1 mock.
 * No Cloudflare account, network call, or real database is used.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");

const source = await readFile(new URL("../functions/api/[[path]].js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { onRequest } = await import(moduleUrl);

const schemaSpec = {
  duga_assignments: { columns: ["id","scope_type","scope_id","role_id","subject_type","user_id","principal_id","status","assigned_by_user_id","created_at","revoked_at"], indexes: ["uq_duga_assignment_human_active","uq_duga_assignment_ai_active","uq_duga_single_platform_owner","idx_duga_assignments_subject"], triggers: [] },
  duga_change_requests: { columns: ["id","title","summary","rationale","status","risk_level","affected_systems_json","affected_paths_json","rollback_plan","requested_by_type","requested_by_user_id","requested_by_principal_id","source_branch","base_commit_sha","policy_commit_sha","implementer_type","implementer_user_id","implementer_principal_id","implementation_commit_sha","state_version","created_at","updated_at"], indexes: ["idx_duga_changes_status_updated","idx_duga_changes_created"], triggers: [] },
  duga_reviews: { columns: ["id","change_request_id","review_type","reviewer_type","reviewer_user_id","reviewer_principal_id","decision","reviewed_commit_sha","evidence_json","created_at"], indexes: ["idx_duga_reviews_change_time"], triggers: ["duga_review_no_implementer_self_audit"] },
  duga_approvals: { columns: ["id","change_request_id","approver_user_id","approver_role","decision","approved_commit_sha","rationale","created_at"], indexes: ["idx_duga_approvals_change_time"], triggers: [] },
  duga_validation_runs: { columns: ["id","change_request_id","commit_sha","status","validator","validator_version","results_json","started_at","completed_at","created_at"], indexes: ["idx_duga_validation_change_time","idx_duga_validation_status"], triggers: [] },
  duga_audit_events: { columns: ["id","aggregate_type","aggregate_id","event_type","actor_type","actor_user_id","actor_principal_id","actor_system_id","payload_json","policy_commit_sha","created_at"], indexes: ["idx_duga_audit_aggregate_time","idx_duga_audit_actor_time","idx_duga_audit_time"], triggers: ["duga_audit_no_update","duga_audit_no_delete"] },
  duga_analysis_findings: { columns: ["id","analyzer_version","repository_commit_sha","file_path","symbol","classification","confidence","evidence_json","status","created_at","reviewed_at","reviewed_by_user_id"], indexes: ["idx_duga_findings_status_time","idx_duga_findings_file_commit"], triggers: [] },
  duga_jobs: { columns: ["id","job_type","status","input_json","result_json","attempts","available_at","lease_expires_at","created_at","updated_at"], indexes: ["idx_duga_jobs_queue"], triggers: [] },
};

function tokenHash(token) {
  return createHash("sha256").update(token).digest("base64url");
}
function mockEnv({ failProbe = false, failSchemaProbe = false, failChanges = false, failChangeDetail = false, failAudit = false, auditRows = [], changeRows = [], changeDetail = null, relatedRows = {}, tables = [], completeSchema = false, omitColumn = null, dbEnabled = true } = {}) {
  const users = new Map([
    [tokenHash("owner-token"), { id: "owner-1", email: "owner@example.test", username: "owner", role: "owner" }],
    [tokenHash("admin-token"), { id: "admin-1", email: "admin@example.test", username: "admin", role: "admin" }],
    [tokenHash("user-token"), { id: "user-1", email: "user@example.test", username: "user", role: "user" }],
  ]);
  const DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("FROM sessions s JOIN users u")) return users.get(this.args[0]) || null;
          if (sql.includes("FROM duga_change_requests WHERE id=?")) { if (failChangeDetail) throw new Error("simulated detail query failure"); return changeDetail; }
          if (sql.includes("FROM user_restrictions WHERE user_id=?")) return null;
          if (sql === "SELECT 1 AS ok") {
            if (failProbe) throw new Error("simulated D1 outage");
            return { ok: 1 };
          }
          throw new Error("Unexpected SQL in test: " + sql);
        },
        async all() {
          if (sql.includes("FROM duga_reviews")) return { results: relatedRows.reviews || [] };
          if (sql.includes("FROM duga_approvals")) return { results: relatedRows.approvals || [] };
          if (sql.includes("FROM duga_validation_runs")) return { results: relatedRows.validationRuns || [] };
          if (sql.includes("FROM duga_audit_events")) { if (failAudit) throw new Error("simulated audit query failure"); return { results: sql.includes("aggregate_type=?") ? auditRows : (relatedRows.auditEvents || []) }; }
          if (sql.includes("FROM duga_change_requests")) {
            if (failChanges) throw new Error("simulated DUGA query failure");
            return { results: changeRows };
          }
          if (sql.includes("FROM sqlite_master")) {
            if (failSchemaProbe) throw new Error("simulated schema probe outage");
            const results = [];
            for (const table of tables) {
              results.push({ type: "table", name: table, tbl_name: table });
              if (completeSchema) {
                for (const name of schemaSpec[table]?.indexes || []) results.push({ type: "index", name, tbl_name: table });
                for (const name of schemaSpec[table]?.triggers || []) results.push({ type: "trigger", name, tbl_name: table });
              }
            }
            return { results };
          }
          if (sql.startsWith("PRAGMA table_info(")) {
            const table = sql.slice("PRAGMA table_info(".length, -1);
            const columns = (schemaSpec[table]?.columns || []).filter(name => !(omitColumn === table + "." + name));
            return { results: columns.map(name => ({ name })) };
          }
          throw new Error("Unexpected SQL in test: " + sql);
        },
      };
    },
  };
  return dbEnabled ? { DB } : {};
}
async function call({ token, method = "GET", path = "/api/governance/health", env = mockEnv(), origin = "https://example.test", contentType = "application/json" } = {}) {
  const headers = new Headers();
  if (token) headers.set("Cookie", "frame_admin_session=" + token);
  if (origin) headers.set("Origin", origin);
  if (contentType) headers.set("Content-Type", contentType);
  const request = new Request("https://example.test" + path, { method, headers });
  const response = await onRequest({ request, env });
  return { response, body: await response.json() };
}
const tests = [];
async function test(name, fn) { await fn(); tests.push(name); }

await test("Owner can read D1 health", async () => {
  const { response, body } = await call({ token: "owner-token" });
  assert.equal(response.status, 200);
  assert.equal(body.schema, "not_installed");
  assert.equal(body.expectedSchemaTables, 8);
  assert.equal(body.missing.tables.length, 8);
});
await test("Admin is explicitly forbidden", async () => {
  const { response } = await call({ token: "admin-token" });
  assert.equal(response.status, 403);
});
await test("Unauthenticated caller is rejected", async () => {
  const { response } = await call();
  assert.equal(response.status, 401);
});
await test("Ordinary User is rejected", async () => {
  const { response } = await call({ token: "user-token" });
  assert.equal(response.status, 401);
});
await test("Owner can list change requests with bounded pagination", async () => {
  const rows = [
    { id: "change-3", title: "Third", summary: "s3", status: "proposed", risk_level: "low", affected_systems_json: '["DCP"]', affected_paths_json: '["src/a.js"]', created_at: 300, updated_at: 301 },
    { id: "change-2", title: "Second", summary: "s2", status: "approved", risk_level: "medium", affected_systems_json: '[]', affected_paths_json: '[]', created_at: 200, updated_at: 201 },
    { id: "change-1", title: "First", summary: "s1", status: "rejected", risk_level: "high", affected_systems_json: '[]', affected_paths_json: '[]', created_at: 100, updated_at: 101 },
  ];
  const { response, body } = await call({ token: "owner-token", path: "/api/governance/changes?limit=2", env: mockEnv({ changeRows: rows }) });
  assert.equal(response.status, 200);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].id, "change-3");
  assert.deepEqual(body.items[0].affected_systems, ["DCP"]);
  assert.equal(body.page.hasMore, true);
  assert.ok(body.page.nextCursor);
});
await test("Change request listing rejects non-Owner", async () => {
  const { response } = await call({ token: "admin-token", path: "/api/governance/changes" });
  assert.equal(response.status, 403);
});
await test("Change request listing validates limit and status", async () => {
  const a = await call({ token: "owner-token", path: "/api/governance/changes?limit=500" });
  const b = await call({ token: "owner-token", path: "/api/governance/changes?status=made-up" });
  assert.equal(a.response.status, 400);
  assert.equal(b.response.status, 400);
});
await test("Change request listing accepts a valid keyset cursor", async () => {
  const cursor = Buffer.from("200:change-2").toString("base64url");
  const { response, body } = await call({ token: "owner-token", path: "/api/governance/changes?limit=10&cursor=" + cursor });
  assert.equal(response.status, 200);
  assert.equal(body.page.hasMore, false);
  assert.equal(body.page.nextCursor, null);
});
await test("Change request listing rejects control characters in search", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes?q=%00" });
  assert.equal(response.status, 400);
});
await test("Change request listing rejects malformed cursor", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes?cursor=not-a-cursor" });
  assert.equal(response.status, 400);
});
await test("Change request listing handles missing schema/storage", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes", env: mockEnv({ failChanges: true }) });
  assert.equal(response.status, 503);
});
await test("Owner can read a change request with bounded related records", async () => {
  const change = { id: "change-42", title: "Example", summary: "Summary", status: "proposed", risk_level: "low", affected_systems_json: '["DCP"]', affected_paths_json: '["src/a.js"]', created_at: 100, updated_at: 101 };
  const { response, body } = await call({ token: "owner-token", path: "/api/governance/changes/change-42", env: mockEnv({ changeDetail: change, relatedRows: { reviews: [{ id: "review-1" }], approvals: [], validationRuns: [], auditEvents: [{ id: "event-1" }] } }) });
  assert.equal(response.status, 200);
  assert.equal(body.change.id, "change-42");
  assert.deepEqual(body.change.affected_systems, ["DCP"]);
  assert.equal(body.reviews.length, 1);
  assert.equal(body.auditEvents.length, 1);
  assert.equal(body.limits.perRelatedCollection, 50);
});
await test("Missing change request returns 404", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes/not-found" });
  assert.equal(response.status, 404);
});
await test("Change detail rejects malformed ID and non-Owner", async () => {
  const malformed = await call({ token: "owner-token", path: "/api/governance/changes/%3Cscript%3E" });
  const forbidden = await call({ token: "admin-token", path: "/api/governance/changes/change-42" });
  assert.equal(malformed.response.status, 400);
  assert.equal(forbidden.response.status, 403);
});
await test("Change detail storage failure returns controlled 503", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes/change-42", env: mockEnv({ failChangeDetail: true }) });
  assert.equal(response.status, 503);
});
await test("Owner can read paginated append-only audit events", async () => {
  const rows = [
    { id: "event-3", aggregate_type: "change_request", aggregate_id: "change-3", event_type: "created", actor_type: "human", created_at: 300 },
    { id: "event-2", aggregate_type: "platform", aggregate_id: "platform", event_type: "policy_updated", actor_type: "system", created_at: 200 },
    { id: "event-1", aggregate_type: "assignment", aggregate_id: "assign-1", event_type: "assigned", actor_type: "human", created_at: 100 },
  ];
  const { response, body } = await call({ token: "owner-token", path: "/api/governance/audit?limit=2&aggregate_type=change_request", env: mockEnv({ auditRows: rows }) });
  assert.equal(response.status, 200);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].id, "event-3");
  assert.equal(body.page.hasMore, true);
  assert.ok(body.page.nextCursor);
});
await test("Audit endpoint validates filters and cursor", async () => {
  const a = await call({ token: "owner-token", path: "/api/governance/audit?aggregate_type=unknown" });
  const b = await call({ token: "owner-token", path: "/api/governance/audit?limit=100" });
  const d = await call({ token: "owner-token", path: "/api/governance/audit?cursor=bad" });
  assert.equal(a.response.status, 400);
  assert.equal(b.response.status, 400);
  assert.equal(d.response.status, 400);
});
await test("Audit endpoint is Owner-only and returns controlled storage errors", async () => {
  const forbidden = await call({ token: "admin-token", path: "/api/governance/audit" });
  const failed = await call({ token: "owner-token", path: "/api/governance/audit", env: mockEnv({ failAudit: true }) });
  assert.equal(forbidden.response.status, 403);
  assert.equal(failed.response.status, 503);
});
await test("Change list and detail reject non-GET methods explicitly", async () => {
  const list = await call({ token: "owner-token", method: "POST", path: "/api/governance/changes" });
  const detail = await call({ token: "owner-token", method: "POST", path: "/api/governance/changes/change-42" });
  const audit = await call({ token: "owner-token", method: "POST", path: "/api/governance/audit" });
  assert.equal(list.response.status, 405);
  assert.equal(detail.response.status, 405);
  assert.equal(audit.response.status, 405);
});
await test("Unknown governance route is not exposed", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes/unknown" });
  assert.equal(response.status, 404);
});
await test("Non-GET health method is rejected", async () => {
  const { response } = await call({ token: "owner-token", method: "POST" });
  assert.equal(response.status, 405);
});
await test("Cross-origin mutation is rejected before route handling", async () => {
  const { response } = await call({ token: "owner-token", method: "POST", origin: "https://attacker.example" });
  assert.equal(response.status, 403);
});
await test("Partial DUGA schema is reported accurately", async () => {
  const { response, body } = await call({
    token: "owner-token",
    env: mockEnv({ tables: ["duga_assignments", "duga_jobs", "users"] }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.schema, "partial");
  assert.deepEqual(body.schemaTables, ["duga_assignments", "duga_jobs"]);
  assert.ok(body.missing.indexes.length > 0);
});
await test("Complete DUGA schema is reported ready", async () => {
  const expected = [
    "duga_assignments", "duga_change_requests", "duga_reviews", "duga_approvals",
    "duga_validation_runs", "duga_audit_events", "duga_analysis_findings", "duga_jobs",
  ];
  const { response, body } = await call({ token: "owner-token", env: mockEnv({ tables: expected, completeSchema: true }) });
  assert.equal(response.status, 200);
  assert.equal(body.schema, "ready");
  assert.equal(body.schemaTables.length, 8);
  assert.deepEqual(body.missing, { tables: [], columns: [], indexes: [], triggers: [] });
});
await test("Missing required column prevents ready status", async () => {
  const expected = Object.keys(schemaSpec);
  const { response, body } = await call({
    token: "owner-token",
    env: mockEnv({ tables: expected, completeSchema: true, omitColumn: "duga_jobs.lease_expires_at" }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.schema, "partial");
  assert.deepEqual(body.missing.columns, ["duga_jobs.lease_expires_at"]);
});
await test("Schema probe failure returns controlled 503", async () => {
  const { response } = await call({ token: "owner-token", env: mockEnv({ failSchemaProbe: true }) });
  assert.equal(response.status, 503);
});
await test("D1 probe failure returns controlled 503", async () => {
  const { response } = await call({ token: "owner-token", env: mockEnv({ failProbe: true }) });
  assert.equal(response.status, 503);
});
await test("Missing D1 binding returns 503", async () => {
  const { response } = await call({ token: "owner-token", env: mockEnv({ dbEnabled: false }) });
  assert.equal(response.status, 503);
});

console.log("DUGA health, read-only change and audit API tests: PASS");
for (const name of tests) console.log("PASS: " + name);
console.log("LIMITATION: mocked D1 and local handler only; no live Cloudflare Pages deployment tested.");
