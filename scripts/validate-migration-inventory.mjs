#!/usr/bin/env node
/**
 * Verify the documentation-only D1 migration inventory.
 * This does not connect to D1 and never applies SQL.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];
const manifestPath = "migrations/manifest.json";
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(root, manifestPath), "utf8"));
} catch (error) {
  errors.push(`${manifestPath}: ${error.message}`);
}

const policy = manifest?.execution_policy;
if (policy?.automatic !== false) errors.push("manifest: automatic execution must remain false");
if (policy?.wrangler_migrations_configured !== false) errors.push("manifest: Wrangler migrations must remain explicitly unconfigured");
if (policy?.requires_human_review !== true) errors.push("manifest: human review must be required");

const entries = manifest?.fresh_database_order;
if (!Array.isArray(entries) || entries.length === 0) {
  errors.push("manifest: fresh_database_order must be a non-empty array");
} else {
  const names = entries.map((entry) => entry.file);
  if (new Set(names).size !== names.length) errors.push("manifest: duplicate migration file entries");
  const orders = entries.map((entry) => entry.order);
  if (orders.some((value, index) => value !== index + 1)) {
    errors.push("manifest: order values must be unique, contiguous and match array order starting at 1");
  }

  const byName = new Map(entries.map((entry) => [entry.file, entry]));
  for (const entry of entries) {
    if (typeof entry.file !== "string" || !/^\\d{4}_[a-z0-9_]+\\.sql$/.test(entry.file)) {
      errors.push(`manifest: invalid migration filename ${String(entry.file)}`);
      continue;
    }
    const absolute = path.resolve(root, "migrations", entry.file);
    if (!absolute.startsWith(path.resolve(root, "migrations") + path.sep)) {
      errors.push(`manifest: unsafe migration path ${entry.file}`);
      continue;
    }
    try {
      if (!(await stat(absolute)).isFile()) errors.push(`manifest: migration is not a file: ${entry.file}`);
    } catch {
      errors.push(`manifest: listed migration is missing: ${entry.file}`);
    }
    if (typeof entry.purpose !== "string" || !entry.purpose.trim()) {
      errors.push(`manifest: missing purpose for ${entry.file}`);
    }
    if (!Array.isArray(entry.depends_on)) errors.push(`manifest: depends_on must be an array for ${entry.file}`);
    else for (const dependency of entry.depends_on) {
      if (!byName.has(dependency)) errors.push(`manifest: ${entry.file} depends on unlisted migration ${dependency}`);
      else if (byName.get(dependency).order >= entry.order) {
        errors.push(`manifest: dependency ${dependency} must precede ${entry.file}`);
      }
    }
  }

  try {
    const diskFiles = (await readdir(path.join(root, "migrations")))
      .filter((name) => /^\\d{4}_.+\\.sql$/.test(name))
      .sort();
    for (const name of diskFiles) if (!byName.has(name)) errors.push(`manifest: SQL migration missing from inventory: ${name}`);
    for (const name of names) if (!diskFiles.includes(name)) errors.push(`manifest: inventory references absent SQL file: ${name}`);

    const prefixGroups = new Map();
    for (const name of diskFiles) {
      const prefix = name.slice(0, 4);
      prefixGroups.set(prefix, [...(prefixGroups.get(prefix) ?? []), name]);
    }
    for (const [prefix, group] of prefixGroups) {
      if (group.length > 1) {
        for (const name of group) {
          const notes = byName.get(name)?.notes ?? [];
          if (!notes.some((note) => typeof note === "string" && note.includes("Shares numeric prefix"))) {
            errors.push(`manifest: duplicate prefix ${prefix} needs an explicit note for ${name}`);
          }
        }
      }
    }
  } catch (error) {
    errors.push(`migrations/: ${error.message}`);
  }
}

const draftPath = "governance/schemas/d1-operational-schema.sql";
try {
  const draft = await readFile(path.join(root, draftPath), "utf8");
  if (!/^--.*DRAFT/im.test(draft) || !/^--.*DESIGN ONLY\\. NOT A MIGRATION\\. DO NOT EXECUTE\\./m.test(draft)) {
    errors.push(`${draftPath}: design-only safety header is missing`);
  }
  if (/^\\s*CREATE TABLE\\s+IF NOT EXISTS\\s+duga_/im.test(draft)) {
    errors.push(`${draftPath}: do not silently convert design draft to executable migration syntax`);
  }
  if (await stat(path.join(root, "migrations/0009_duga_governance_foundation.sql")).then(() => true).catch(() => false)) {
    errors.push("migrations/0009_duga_governance_foundation.sql exists while Preview migration history has not been reconciled; require explicit review");
  }
} catch (error) {
  errors.push(`${draftPath}: ${error.message}`);
}

if (errors.length) {
  console.error(`D1 migration inventory validation failed (${errors.length} issue(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("D1 migration inventory passed: manifest, file coverage, dependency order, duplicate-prefix notes and draft safety are consistent.");
  console.log("No D1 database was contacted and no SQL was executed.");
}
