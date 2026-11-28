#!/usr/bin/env node
/**
 * Static integrity checks for DUGA's GitHub desired-state metadata.
 * Run from the repository root: node scripts/validate-governance.mjs
 * No network, database, secrets, or mutation is used.
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];
const readJson = async (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
};
const exists = async (relativePath) => {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
};
const unique = (values) => new Set(values).size === values.length;

const [registry, dependencies, ownership] = await Promise.all([
  readJson("governance/registry/systems.json"),
  readJson("governance/dependencies/systems.json"),
  readJson("governance/ownership/roles.json"),
]);

if (registry) {
  if (!Array.isArray(registry.systems) || registry.systems.length === 0) {
    errors.push("systems.json: systems must be a non-empty array");
  } else {
    const ids = registry.systems.map((system) => system.id);
    if (ids.some((id) => typeof id !== "string" || !id.trim())) {
      errors.push("systems.json: every system must have a non-empty string id");
    }
    if (!unique(ids)) errors.push("systems.json: duplicate system IDs found");

    const systemIds = new Set(ids);
    for (const system of registry.systems) {
      for (const field of ["ownerRole", "maintainerRole", "auditorRole"]) {
        if (typeof system[field] !== "string" || !system[field]) {
          errors.push(`systems.json: ${system.id} has no ${field}`);
        }
      }
      if (!Array.isArray(system.dependencies)) {
        errors.push(`systems.json: ${system.id}.dependencies must be an array`);
      } else {
        for (const dependencyId of system.dependencies) {
          if (!systemIds.has(dependencyId)) {
            errors.push(`systems.json: ${system.id} references unknown dependency ${dependencyId}`);
          }
        }
      }
      if (!Array.isArray(system.paths) || system.paths.length === 0) {
        errors.push(`systems.json: ${system.id}.paths must be a non-empty array`);
      } else {
        for (const sourcePath of system.paths) {
          if (typeof sourcePath !== "string" || !sourcePath || !(await exists(sourcePath))) {
            errors.push(`systems.json: ${system.id} references missing path ${sourcePath}`);
          }
        }
      }
    }
  }
}

if (ownership) {
  if (!Array.isArray(ownership.roles)) {
    errors.push("roles.json: roles must be an array");
  } else {
    const roleIds = ownership.roles.map((role) => role.id);
    if (!unique(roleIds)) errors.push("roles.json: duplicate role IDs found");
    const knownRoles = new Set(roleIds);
    for (const system of registry?.systems ?? []) {
      for (const field of ["ownerRole", "maintainerRole", "auditorRole"]) {
        if (!knownRoles.has(system[field])) {
          errors.push(`systems.json: ${system.id} references unknown role ${system[field]}`);
        }
      }
    }
  }
}

if (dependencies) {
  const systemIds = new Set((registry?.systems ?? []).map((system) => system.id));
  if (!Array.isArray(dependencies.edges)) {
    errors.push("dependencies/systems.json: edges must be an array");
  } else {
    const edgeKeys = dependencies.edges.map((edge) => `${edge.from}|${edge.to}|${edge.type}`);
    if (!unique(edgeKeys)) errors.push("dependencies/systems.json: duplicate dependency edges found");
    for (const edge of dependencies.edges) {
      if (!systemIds.has(edge.from)) errors.push(`dependencies: unknown source system ${edge.from}`);
      if (!systemIds.has(edge.to)) errors.push(`dependencies: unknown target system ${edge.to}`);
      if (edge.from === edge.to) errors.push(`dependencies: self-reference on ${edge.from}`);
      if (typeof edge.evidence !== "string" || !edge.evidence.trim()) {
        errors.push(`dependencies: edge ${edge.from} -> ${edge.to} has no evidence note`);
      }
    }
  }
  if (Array.isArray(dependencies.pageAssets)) {
    for (const page of dependencies.pageAssets) {
      if (!(await exists(page.page))) errors.push(`dependencies: missing page asset ${page.page}`);
      if (!Array.isArray(page.systems)) {
        errors.push(`dependencies: ${page.page} systems must be an array`);
      } else {
        for (const id of page.systems) {
          if (!systemIds.has(id)) errors.push(`dependencies: ${page.page} references unknown system ${id}`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`DUGA metadata validation failed (${errors.length} issue(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("DUGA metadata validation passed: JSON, IDs, role references, system references, evidence notes and source paths are consistent.");
}
