const CHANGE_SQL = `
UPDATE duga_change_requests
SET status = ?,
    state_version = state_version + 1,
    last_transition_id = ?,
    updated_at = ?
WHERE id = ?
  AND state_version = ?
  AND status = ?
  AND NOT EXISTS (
    SELECT 1 FROM duga_audit_events WHERE transition_id = ?
  )
`;

const AUDIT_SQL = `
INSERT INTO duga_audit_events
  (id, aggregate_type, aggregate_id, event_type, actor_type,
   actor_user_id, actor_principal_id, actor_system_id,
   payload_json, transition_id, policy_commit_sha, created_at)
SELECT
  ?, 'change_request', id, 'state_transition', ?,
  NULL, NULL, ?, ?, ?, ?, updated_at
FROM duga_change_requests
WHERE id = ?
  AND state_version = ?
  AND last_transition_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM duga_audit_events WHERE transition_id = ?
  )
`;

const json = (value, status = 200) =>
  new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

function changes(result) {
  return Number(result?.meta?.changes ?? -1);
}

async function seedChange(db, id, now) {
  await db.prepare("INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING")
    .bind("duga-acceptance-synthetic-user").run();

  await db.prepare(`
    INSERT INTO duga_change_requests
      (id,title,summary,rationale,status,risk_level,affected_systems_json,
       affected_paths_json,rollback_plan,requested_by_type,requested_by_user_id,
       source_branch,base_commit_sha,policy_commit_sha,state_version,
       last_transition_id,created_at,updated_at)
    VALUES (?, 'D1 acceptance fixture', 'Synthetic test row only', '',
      'proposed', 'low', '[]', '[]', 'No-op synthetic test rollback',
      'human', 'duga-acceptance-synthetic-user',
      'acceptance/test-only', NULL, 'acceptance-policy-fixture',
      1, NULL, ?, ?)
  `).bind(id, now, now).run();
}

async function transition(db, rowId, expectedVersion, expectedStatus, nextStatus, token, auditId, opts = {}) {
  const now = Date.now();
  const actorType = opts.actorType ?? "system";
  const actorSystemId = opts.actorSystemId ?? "duga-d1-acceptance-worker";
  const payload = JSON.stringify({ test: true, case: opts.caseName ?? "transition" });
  const batch = [
    db.prepare(CHANGE_SQL).bind(nextStatus, token, now, rowId, expectedVersion, expectedStatus, token),
    db.prepare(AUDIT_SQL).bind(
      auditId, actorType, actorSystemId, payload, token,
      "acceptance-policy-fixture", rowId, expectedVersion + 1, token, token
    )
  ];
  const results = await db.batch(batch);
  return { updateChanges: changes(results[0]), auditChanges: changes(results[1]) };
}

async function readState(db, id) {
  return db.prepare(`
    SELECT status, state_version, last_transition_id
    FROM duga_change_requests WHERE id = ?
  `).bind(id).first();
}

async function runSuite(db) {
  const prefix = crypto.randomUUID();
  const now = Date.now();
  const out = {};

  const successId = prefix + "-success";
  const successToken = crypto.randomUUID();
  await seedChange(db, successId, now);
  out.success = await transition(db, successId, 1, "proposed", "analyzing",
    successToken, prefix + "-audit-success", { caseName: "success" });

  const staleId = prefix + "-stale";
  await seedChange(db, staleId, now);
  out.stale = await transition(db, staleId, 99, "proposed", "analyzing",
    crypto.randomUUID(), prefix + "-audit-stale", { caseName: "stale" });

  out.replay = await transition(db, successId, 1, "proposed", "analyzing",
    successToken, prefix + "-audit-replay", { caseName: "replay" });

  out.tokenReuse = await transition(db, successId, 2, "analyzing", "impact_review",
    successToken, prefix + "-audit-token-reuse", { caseName: "token-reuse" });

  const rollbackId = prefix + "-rollback";
  await seedChange(db, rollbackId, now);
  let rollbackError = null;
  try {
    await transition(db, rollbackId, 1, "proposed", "analyzing",
      crypto.randomUUID(), prefix + "-audit-rollback", { actorType: "invalid-actor", caseName: "forced-check-failure" });
  } catch (error) {
    rollbackError = String(error?.message ?? error);
  }
  out.auditFailureRollback = {
    batchRejected: Boolean(rollbackError),
    error: rollbackError,
    stateAfter: await readState(db, rollbackId)
  };

  const raceId = prefix + "-race";
  await seedChange(db, raceId, now);
  const raceAttempts = await Promise.all([
    transition(db, raceId, 1, "proposed", "analyzing", crypto.randomUUID(),
      prefix + "-audit-race-a", { caseName: "race-a" }),
    transition(db, raceId, 1, "proposed", "analyzing", crypto.randomUUID(),
      prefix + "-audit-race-b", { caseName: "race-b" })
  ]);
  const raceAuditCount = await db.prepare(`
    SELECT COUNT(*) AS count FROM duga_audit_events
    WHERE aggregate_type = 'change_request' AND aggregate_id = ?
  `).bind(raceId).first();
  out.concurrentWriters = {
    attempts: raceAttempts,
    finalState: await readState(db, raceId),
    auditCount: Number(raceAuditCount?.count ?? -1)
  };

  const successAudit = await db.prepare(`
    SELECT COUNT(*) AS count FROM duga_audit_events WHERE transition_id = ?
  `).bind(successToken).first();
  out.success.auditCountForToken = Number(successAudit?.count ?? -1);

  out.pass = (
    out.success.updateChanges === 1 &&
    out.success.auditChanges === 1 &&
    out.stale.updateChanges === 0 &&
    out.stale.auditChanges === 0 &&
    out.replay.updateChanges === 0 &&
    out.replay.auditChanges === 0 &&
    out.tokenReuse.updateChanges === 0 &&
    out.tokenReuse.auditChanges === 0 &&
    out.auditFailureRollback.batchRejected &&
    out.auditFailureRollback.stateAfter?.state_version === 1 &&
    out.auditFailureRollback.stateAfter?.last_transition_id === null &&
    raceAttempts.filter(x => x.updateChanges === 1 && x.auditChanges === 1).length === 1 &&
    raceAttempts.filter(x => x.updateChanges === 0 && x.auditChanges === 0).length === 1 &&
    out.concurrentWriters.auditCount === 1 &&
    out.success.auditCountForToken === 1
  );

  return {
    suite: "DUGA disposable D1 CAS + audit acceptance",
    databaseBinding: "DB",
    runId: prefix,
    completedAt: new Date().toISOString(),
    results: out,
    note: "Test-only synthetic rows and audit events are retained. No production or Preview database should be bound."
  };
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return json({ error: "POST required" }, 405);
    const url = new URL(request.url);

    // TEMPORARY: unauthenticated fingerprint comparison for acceptance-secret diagnosis.
    // Remove this route after the mismatch is identified.
    if (url.pathname === "/_diag-secret") {
      if (!env.ACCEPTANCE_SECRET) return json({ configured: false, matches: false, length: 0 });
      let body;
      try {
        const raw = await request.text();
        if (raw.length > 256) return json({ error: "Request too large" }, 413);
        body = JSON.parse(raw);
      } catch {
        return json({ error: "Expected JSON body with sha256" }, 400);
      }
      if (typeof body?.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(body.sha256)) {
        return json({ error: "Invalid sha256" }, 400);
      }
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(env.ACCEPTANCE_SECRET)
      );
      const runtimeHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      return json({
        configured: true,
        length: env.ACCEPTANCE_SECRET.length,
        matches: runtimeHash === body.sha256.toLowerCase()
      });
    }

    const supplied = request.headers.get("authorization") ?? "";
    if (!env.ACCEPTANCE_SECRET || supplied !== `Bearer ${env.ACCEPTANCE_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!env.DB) return json({ error: "D1 binding DB is missing" }, 500);
    if (url.pathname !== "/run") return json({ error: "Not found" }, 404);
    try {
      const result = await runSuite(env.DB);
      return json(result, result.results.pass ? 200 : 409);
    } catch (error) {
      return json({ error: "Acceptance suite aborted", detail: String(error?.message ?? error) }, 500);
    }
  }
};
