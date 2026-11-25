#!/usr/bin/env node
/**
 * Integration-style tests for the initial DUGA health route.
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
  duga_assignments: { columns: ["id","scope_type","scope_id","role_id","subject_type","user_id","principal_id","status","assigned_by_user_id","created_at","revoked_at"], indexes: ["uq_duga_assignment_human_active","uq_duga_assignment_ai_active","idx_duga_assignments_subject"], triggers: [] },
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
function mockEnv({ failProbe = false, failSchemaProbe = false, tables = [], completeSchema = false, omitColumn = null, dbEnabled = true } = {}) {
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
          if (sql.includes("FROM user_restrictions WHERE user_id=?")) return null;
          if (sql === "SELECT 1 AS ok") {
            if (failProbe) throw new Error("simulated D1 outage");
            return { ok: 1 };
          }
          throw new Error("Unexpected SQL in test: " + sql);
        },
        async all() {
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
await test("Unknown governance route is not exposed", async () => {
  const { response } = await call({ token: "owner-token", path: "/api/governance/changes" });
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

console.log("DUGA health API tests: PASS");
for (const name of tests) console.log("PASS: " + name);
console.log("LIMITATION: mocked D1 and local handler only; no live Cloudflare Pages deployment tested.");
