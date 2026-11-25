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

function tokenHash(token) {
  return createHash("sha256").update(token).digest("base64url");
}
function mockEnv({ role = "owner", failProbe = false, dbEnabled = true } = {}) {
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
  assert.deepEqual(body, { ok: true, service: "DUGA", database: "reachable", access: "owner" });
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
