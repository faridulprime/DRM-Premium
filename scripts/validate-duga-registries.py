#!/usr/bin/env python3
"""Validate DUGA's versioned governance JSON registries using stdlib only."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ROOT / "governance/ownership/roles.json"
SYSTEMS = ROOT / "governance/dependencies/systems.json"
RULES = ROOT / "governance/dependencies/dependency-rules.json"
REGISTRY = ROOT / "governance/registry/systems.json"
OWNERSHIP = ROOT / "governance/ownership/ownership.json"

def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: root must be an object")
    return value

def nonempty(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())

def validate_roles(data: dict) -> list[str]:
    errors: list[str] = []
    roles = data.get("roles")
    if not nonempty(data.get("version")) or not isinstance(roles, list) or not roles:
        return ["roles.json: version and non-empty roles array are required"]
    seen: set[str] = set()
    for i, role in enumerate(roles):
        where = f"roles.json: roles[{i}]"
        if not isinstance(role, dict):
            errors.append(f"{where} must be an object")
            continue
        rid, kind = role.get("id"), role.get("kind")
        if not nonempty(rid) or rid in seen:
            errors.append(f"{where} has missing or duplicate id: {rid!r}")
        else:
            seen.add(rid)
        if kind not in {"human", "ai"}:
            errors.append(f"{where} kind must be human or ai")
        if not nonempty(role.get("description")):
            errors.append(f"{where} description is required")
        perms = role.get("permissions")
        if not isinstance(perms, list) or not perms or any(not nonempty(p) for p in perms):
            errors.append(f"{where} permissions must be a non-empty string array")
        elif len(perms) != len(set(perms)):
            errors.append(f"{where} permissions contain duplicates")
    required = {
        "platform-owner": "human",
        "governance-manager": "human",
        "system-owner": "human",
        "ai-maintainer": "ai",
        "independent-ai-auditor": "ai",
        "read-only-observer": "human",
    }
    actual = {r.get("id"): r.get("kind") for r in roles if isinstance(r, dict)}
    for rid, kind in required.items():
        if actual.get(rid) != kind:
            errors.append(f"roles.json: required role {rid!r} must have kind {kind!r}")
    sod = data.get("separationOfDuties")
    if not isinstance(sod, list) or not sod or any(not nonempty(x) for x in sod):
        errors.append("roles.json: separationOfDuties must be a non-empty string array")
    return errors

def validate_dependencies(systems: dict, rules: dict) -> list[str]:
    errors: list[str] = []
    if not nonempty(systems.get("version")):
        errors.append("systems.json: version is required")
    edges = systems.get("edges")
    if not isinstance(edges, list):
        errors.append("systems.json: edges must be an array")
        edges = []
    allowed_types = {"runtime-import", "asset-reference", "data-contract", "boundary-coordination", "governance-documentation"}
    seen_edges: set[tuple[str, str, str]] = set()
    for i, edge in enumerate(edges):
        where = f"systems.json: edges[{i}]"
        if not isinstance(edge, dict):
            errors.append(f"{where} must be an object")
            continue
        source, target, kind = edge.get("from"), edge.get("to"), edge.get("type")
        if not nonempty(source) or not nonempty(target) or source == target:
            errors.append(f"{where} requires distinct non-empty from/to identifiers")
        if kind not in allowed_types:
            errors.append(f"{where} has unsupported edge type {kind!r}")
        if not nonempty(edge.get("evidence")):
            errors.append(f"{where} requires evidence")
        if nonempty(source) and nonempty(target) and kind in allowed_types:
            key = (source, target, kind)
            if key in seen_edges:
                errors.append(f"{where} duplicates edge {key!r}")
            seen_edges.add(key)
    pages = systems.get("pageAssets")
    if not isinstance(pages, list):
        errors.append("systems.json: pageAssets must be an array")
        pages = []
    seen_pages: set[str] = set()
    for i, page in enumerate(pages):
        where = f"systems.json: pageAssets[{i}]"
        if not isinstance(page, dict) or not nonempty(page.get("page")):
            errors.append(f"{where} requires a page path")
            continue
        if page["page"] in seen_pages:
            errors.append(f"{where} duplicates page {page['page']!r}")
        seen_pages.add(page["page"])
        refs = page.get("systems")
        if not isinstance(refs, list) or not refs or any(not nonempty(x) for x in refs):
            errors.append(f"{where} systems must be a non-empty string array")
        elif len(refs) != len(set(refs)):
            errors.append(f"{where} contains duplicate system references")
        if not nonempty(page.get("evidence")):
            errors.append(f"{where} requires evidence")
    if not nonempty(systems.get("caveat")):
        errors.append("systems.json: caveat is required")
    rule_list = rules.get("rules")
    if not nonempty(rules.get("version")) or not isinstance(rule_list, list) or not rule_list or any(not nonempty(x) for x in rule_list):
        errors.append("dependency-rules.json: version and non-empty rules array are required")
    return errors


def validate_system_registry(registry: dict, ownership: dict, roles: dict, dependencies: dict) -> list[str]:
    errors: list[str] = []
    systems = registry.get("systems")
    if not nonempty(registry.get("schemaVersion")) or not nonempty(registry.get("registryVersion")) or not isinstance(systems, list) or not systems:
        return ["registry/systems.json: schemaVersion, registryVersion and non-empty systems array are required"]
    role_kinds = {r.get("id"): r.get("kind") for r in roles.get("roles", []) if isinstance(r, dict)}
    by_id: dict[str, dict] = {}
    for i, system in enumerate(systems):
        where = f"registry/systems.json: systems[{i}]"
        if not isinstance(system, dict):
            errors.append(f"{where} must be an object")
            continue
        sid = system.get("id")
        if not nonempty(sid) or sid in by_id:
            errors.append(f"{where} has missing or duplicate system id {sid!r}")
            continue
        by_id[sid] = system
        for field in ("name", "version", "description"):
            if not nonempty(system.get(field)):
                errors.append(f"{where} requires non-empty {field}")
        if system.get("status") not in {"proposed", "active", "deprecated", "retired"}:
            errors.append(f"{where} has unsupported status")
        if not isinstance(system.get("runtimeCritical"), bool):
            errors.append(f"{where} runtimeCritical must be boolean")
        paths = system.get("paths")
        if not isinstance(paths, list) or not paths or any(not nonempty(p) for p in paths) or len(paths) != len(set(paths)):
            errors.append(f"{where} paths must be a non-empty unique string array")
        deps = system.get("dependencies")
        if not isinstance(deps, list) or any(not nonempty(d) for d in deps) or len(deps) != len(set(deps)):
            errors.append(f"{where} dependencies must be a unique string array")
        for field, kind in (("ownerRole", "human"), ("maintainerRole", "ai"), ("auditorRole", "ai")):
            if role_kinds.get(system.get(field)) != kind:
                errors.append(f"{where} {field} must reference a registered {kind} role")
        if system.get("maintainerRole") == system.get("auditorRole"):
            errors.append(f"{where} maintainer and auditor roles must be distinct")
    for sid, system in by_id.items():
        for dep in system.get("dependencies", []) if isinstance(system.get("dependencies"), list) else []:
            if dep not in by_id or dep == sid:
                errors.append(f"registry/systems.json: {sid} has invalid dependency {dep!r}")
    # Dependency cycles are rejected by default; intentional cycles need a future explicit policy exception.
    visiting: set[str] = set()
    visited: set[str] = set()
    def visit(node: str) -> None:
        if node in visiting:
            errors.append(f"registry/systems.json: dependency cycle detected at {node}")
            return
        if node in visited:
            return
        visiting.add(node)
        node_deps = by_id.get(node, {}).get("dependencies", [])
        if isinstance(node_deps, list):
            for dep in node_deps:
                if dep in by_id:
                    visit(dep)
        visiting.remove(node)
        visited.add(node)
    for sid in by_id:
        visit(sid)
    assignments = ownership.get("assignments")
    if not nonempty(ownership.get("version")) or not isinstance(assignments, list):
        errors.append("ownership.json: version and assignments array are required")
        assignments = []
    owner_by_system: dict[str, list[dict]] = {}
    for i, assignment in enumerate(assignments):
        where = f"ownership.json: assignments[{i}]"
        if not isinstance(assignment, dict) or not nonempty(assignment.get("systemId")):
            errors.append(f"{where} requires a systemId")
            continue
        owner_by_system.setdefault(assignment["systemId"], []).append(assignment)
        for field in ("accountableRole", "implementationRole", "independentReviewRole"):
            if assignment.get(field) not in role_kinds:
                errors.append(f"{where} references unknown {field}")
        if assignment.get("implementationRole") == assignment.get("independentReviewRole"):
            errors.append(f"{where} implementation and review roles must be distinct")
    for sid, system in by_id.items():
        matches = owner_by_system.get(sid, [])
        if len(matches) != 1:
            errors.append(f"ownership.json: system {sid} must have exactly one assignment")
        elif (matches[0].get("accountableRole") != system.get("ownerRole")
              or matches[0].get("implementationRole") != system.get("maintainerRole")
              or matches[0].get("independentReviewRole") != system.get("auditorRole")):
            errors.append(f"ownership.json: role assignments for {sid} do not match system registry")
    for sid in owner_by_system:
        if sid not in by_id:
            errors.append(f"ownership.json: assignment references unknown system {sid!r}")
    known = set(by_id)
    for i, edge in enumerate(dependencies.get("edges", [])):
        if isinstance(edge, dict) and (edge.get("from") not in known or edge.get("to") not in known):
            errors.append(f"dependencies/systems.json: edges[{i}] references unknown system")
    for i, page in enumerate(dependencies.get("pageAssets", [])):
        if isinstance(page, dict) and isinstance(page.get("systems"), list):
            if any(sid not in known for sid in page["systems"]):
                errors.append(f"dependencies/systems.json: pageAssets[{i}] references unknown system")
    return errors

def main() -> int:
    try:
        roles, systems, rules = load(ROLES), load(SYSTEMS), load(RULES)
        registry, ownership = load(REGISTRY), load(OWNERSHIP)
        errors = (validate_roles(roles) + validate_dependencies(systems, rules)
                  + validate_system_registry(registry, ownership, roles, systems))
    except ValueError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("DUGA registry validation: PASS")
    print(f"Roles: {len(roles['roles'])}; registered systems: {len(registry['systems'])}; dependency edges: {len(systems['edges'])}; page asset maps: {len(systems['pageAssets'])}")
    print("NOTE: structural validation only; it does not prove runtime dependency completeness or authorize governance actions.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
