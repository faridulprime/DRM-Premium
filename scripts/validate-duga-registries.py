#!/usr/bin/env python3
"""Validate DUGA governance registries and policy contracts (stdlib only)."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "roles": ROOT / "governance/ownership/roles.json",
    "dependencies": ROOT / "governance/dependencies/systems.json",
    "dependency_rules": ROOT / "governance/dependencies/dependency-rules.json",
    "registry": ROOT / "governance/registry/systems.json",
    "ownership": ROOT / "governance/ownership/ownership.json",
    "registry_rules": ROOT / "governance/registry/registry-rules.json",
    "risk_policy": ROOT / "governance/policies/risk-classification.json",
    "approval_policy": ROOT / "governance/policies/change-approval.json",
    "system_schema": ROOT / "governance/registry/system-schema.json",
}

def load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: root must be an object")
    return value

def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())

def string_list(value: Any, *, nonempty_list: bool = False) -> bool:
    return (isinstance(value, list) and (bool(value) or not nonempty_list)
            and all(nonempty(item) for item in value))

def unique_strings(value: Any, *, nonempty_list: bool = False) -> bool:
    return (string_list(value, nonempty_list=nonempty_list)
            and len(value) == len(set(value)))

def validate_roles(data: dict[str, Any]) -> list[str]:
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
        if not nonempty(rid):
            errors.append(f"{where} id must be a non-empty string")
        elif rid in seen:
            errors.append(f"{where} has duplicate id {rid!r}")
        else:
            seen.add(rid)
        if kind not in ("human", "ai"):
            errors.append(f"{where} kind must be human or ai")
        if not nonempty(role.get("description")):
            errors.append(f"{where} description is required")
        if not unique_strings(role.get("permissions"), nonempty_list=True):
            errors.append(f"{where} permissions must be a non-empty unique string array")
    required = {
        "platform-owner": "human", "governance-manager": "human",
        "system-owner": "human", "ai-maintainer": "ai",
        "independent-ai-auditor": "ai", "read-only-observer": "human",
    }
    actual = {r["id"]: r.get("kind") for r in roles
              if isinstance(r, dict) and nonempty(r.get("id"))}
    for rid, kind in required.items():
        if actual.get(rid) != kind:
            errors.append(f"roles.json: required role {rid!r} must have kind {kind!r}")
    if not string_list(data.get("separationOfDuties"), nonempty_list=True):
        errors.append("roles.json: separationOfDuties must be a non-empty string array")
    return errors

def validate_dependencies(data: dict[str, Any], rules: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not nonempty(data.get("version")):
        errors.append("dependencies/systems.json: version is required")
    edges = data.get("edges")
    if not isinstance(edges, list):
        errors.append("dependencies/systems.json: edges must be an array")
        edges = []
    allowed = {"runtime-import", "asset-reference", "data-contract",
               "boundary-coordination", "governance-documentation"}
    seen: set[tuple[str, str, str]] = set()
    for i, edge in enumerate(edges):
        where = f"dependencies/systems.json: edges[{i}]"
        if not isinstance(edge, dict):
            errors.append(f"{where} must be an object")
            continue
        source, target, kind = edge.get("from"), edge.get("to"), edge.get("type")
        if not nonempty(source) or not nonempty(target) or source == target:
            errors.append(f"{where} requires distinct non-empty from/to identifiers")
        if not isinstance(kind, str) or kind not in allowed:
            errors.append(f"{where} has unsupported edge type {kind!r}")
        if not nonempty(edge.get("evidence")):
            errors.append(f"{where} requires evidence")
        if nonempty(source) and nonempty(target) and isinstance(kind, str) and kind in allowed:
            key = (source, target, kind)
            if key in seen:
                errors.append(f"{where} duplicates edge {key!r}")
            seen.add(key)
    pages = data.get("pageAssets")
    if not isinstance(pages, list):
        errors.append("dependencies/systems.json: pageAssets must be an array")
        pages = []
    seen_pages: set[str] = set()
    for i, page in enumerate(pages):
        where = f"dependencies/systems.json: pageAssets[{i}]"
        if not isinstance(page, dict) or not nonempty(page.get("page")):
            errors.append(f"{where} requires a page path")
            continue
        if page["page"] in seen_pages:
            errors.append(f"{where} duplicates page {page['page']!r}")
        seen_pages.add(page["page"])
        if not unique_strings(page.get("systems"), nonempty_list=True):
            errors.append(f"{where} systems must be a non-empty unique string array")
        if not nonempty(page.get("evidence")):
            errors.append(f"{where} requires evidence")
    if not nonempty(data.get("caveat")):
        errors.append("dependencies/systems.json: caveat is required")
    if (not nonempty(rules.get("version"))
            or not string_list(rules.get("rules"), nonempty_list=True)):
        errors.append("dependency-rules.json: version and non-empty string rules are required")
    return errors

def validate_system_registry(registry: dict[str, Any], ownership: dict[str, Any],
                             roles: dict[str, Any], dependencies: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    systems = registry.get("systems")
    if (not nonempty(registry.get("schemaVersion"))
            or not nonempty(registry.get("registryVersion"))
            or not isinstance(systems, list) or not systems):
        return ["registry/systems.json: schemaVersion, registryVersion and non-empty systems array are required"]
    role_kinds = {r["id"]: r.get("kind") for r in roles.get("roles", [])
                  if isinstance(r, dict) and nonempty(r.get("id"))}
    by_id: dict[str, dict[str, Any]] = {}
    for i, system in enumerate(systems):
        where = f"registry/systems.json: systems[{i}]"
        if not isinstance(system, dict):
            errors.append(f"{where} must be an object")
            continue
        sid = system.get("id")
        if not nonempty(sid):
            errors.append(f"{where} id must be a non-empty string")
            continue
        if sid in by_id:
            errors.append(f"{where} has duplicate system id {sid!r}")
            continue
        by_id[sid] = system
        for field in ("name", "version", "description"):
            if not nonempty(system.get(field)):
                errors.append(f"{where} requires non-empty {field}")
        if system.get("status") not in ("proposed", "active", "deprecated", "retired"):
            errors.append(f"{where} has unsupported status")
        if not isinstance(system.get("runtimeCritical"), bool):
            errors.append(f"{where} runtimeCritical must be boolean")
        if not unique_strings(system.get("paths"), nonempty_list=True):
            errors.append(f"{where} paths must be a non-empty unique string array")
        if not unique_strings(system.get("dependencies")):
            errors.append(f"{where} dependencies must be a unique string array")
        for field, kind in (("ownerRole", "human"), ("maintainerRole", "ai"),
                            ("auditorRole", "ai")):
            if role_kinds.get(system.get(field)) != kind:
                errors.append(f"{where} {field} must reference a registered {kind} role")
        if system.get("maintainerRole") == system.get("auditorRole"):
            errors.append(f"{where} maintainer and auditor roles must be distinct")

    graph: dict[str, list[str]] = {}
    for sid, system in by_id.items():
        deps = system.get("dependencies")
        graph[sid] = deps if isinstance(deps, list) else []
        for dep in graph[sid]:
            if not nonempty(dep) or dep not in by_id or dep == sid:
                errors.append(f"registry/systems.json: {sid} has invalid dependency {dep!r}")

    # Iterative DFS avoids recursion-depth failures on large or malformed registries.
    color: dict[str, int] = {}
    for start in graph:
        if color.get(start, 0):
            continue
        stack: list[tuple[str, int]] = [(start, 0)]
        color[start] = 1
        while stack:
            node, index = stack[-1]
            neighbours = graph.get(node, [])
            if index >= len(neighbours):
                color[node] = 2
                stack.pop()
                continue
            neighbour = neighbours[index]
            stack[-1] = (node, index + 1)
            if neighbour not in graph:
                continue
            if color.get(neighbour) == 1:
                errors.append(f"registry/systems.json: dependency cycle detected from {node} to {neighbour}")
            elif color.get(neighbour, 0) == 0:
                color[neighbour] = 1
                stack.append((neighbour, 0))

    assignments = ownership.get("assignments")
    if not nonempty(ownership.get("version")) or not isinstance(assignments, list):
        errors.append("ownership.json: version and assignments array are required")
        assignments = []
    by_system: dict[str, list[dict[str, Any]]] = {}
    for i, assignment in enumerate(assignments):
        where = f"ownership.json: assignments[{i}]"
        if not isinstance(assignment, dict) or not nonempty(assignment.get("systemId")):
            errors.append(f"{where} requires a non-empty systemId")
            continue
        sid = assignment["systemId"]
        by_system.setdefault(sid, []).append(assignment)
        for field, expected in (("accountableRole", "human"),
                                ("implementationRole", "ai"),
                                ("independentReviewRole", "ai")):
            role = assignment.get(field)
            if not isinstance(role, str) or role_kinds.get(role) != expected:
                errors.append(f"{where} {field} must reference a registered {expected} role")
        if assignment.get("implementationRole") == assignment.get("independentReviewRole"):
            errors.append(f"{where} implementation and review roles must be distinct")
    for sid, system in by_id.items():
        matches = by_system.get(sid, [])
        if len(matches) != 1:
            errors.append(f"ownership.json: system {sid} must have exactly one assignment")
        else:
            item = matches[0]
            if (item.get("accountableRole") != system.get("ownerRole")
                    or item.get("implementationRole") != system.get("maintainerRole")
                    or item.get("independentReviewRole") != system.get("auditorRole")):
                errors.append(f"ownership.json: role assignments for {sid} do not match system registry")
    for sid in by_system:
        if sid not in by_id:
            errors.append(f"ownership.json: assignment references unknown system {sid!r}")

    edges = dependencies.get("edges", [])
    if isinstance(edges, list):
        for i, edge in enumerate(edges):
            if isinstance(edge, dict) and (
                edge.get("from") not in by_id or edge.get("to") not in by_id
            ):
                errors.append(f"dependencies/systems.json: edges[{i}] references unknown system")
    pages = dependencies.get("pageAssets", [])
    if isinstance(pages, list):
        for i, page in enumerate(pages):
            if isinstance(page, dict) and isinstance(page.get("systems"), list):
                if any(not isinstance(sid, str) or sid not in by_id for sid in page["systems"]):
                    errors.append(f"dependencies/systems.json: pageAssets[{i}] references unknown system")
    return errors

def validate_risk_policy(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected = {
        "low": ("system-owner", "schema-or-diff-check"),
        "medium": ("system-owner-and-platform-policy", "relevant-automated-tests"),
        "high": ("platform-owner-explicit", "independent-review-and-relevant-tests"),
        "critical": ("platform-owner-explicit-and-separate-execution-authorization",
                     "documented-recovery-plan-and-independent-verification"),
    }
    levels = data.get("levels")
    if not nonempty(data.get("version")) or not isinstance(levels, list):
        return ["risk-classification.json: version and levels array are required"]
    seen: set[str] = set()
    actual: dict[str, dict[str, Any]] = {}
    for i, level in enumerate(levels):
        where = f"risk-classification.json: levels[{i}]"
        if not isinstance(level, dict):
            errors.append(f"{where} must be an object")
            continue
        rid = level.get("id")
        if not nonempty(rid):
            errors.append(f"{where} id must be a non-empty string")
            continue
        if rid in seen:
            errors.append(f"{where} duplicates risk level {rid!r}")
        seen.add(rid)
        actual[rid] = level
        for field in ("description", "approval", "validation"):
            if not nonempty(level.get(field)):
                errors.append(f"{where} requires {field}")
    if seen != set(expected):
        errors.append("risk-classification.json: levels must be exactly low, medium, high and critical")
    for rid, (approval, validation) in expected.items():
        level = actual.get(rid)
        if level and (level.get("approval") != approval or level.get("validation") != validation):
            errors.append(f"risk-classification.json: {rid} approval/validation contract is inconsistent")
    if data.get("default") != "high":
        errors.append("risk-classification.json: default risk must remain high")
    if not string_list(data.get("rules"), nonempty_list=True):
        errors.append("risk-classification.json: rules must be a non-empty string array")
    return errors

def validate_approval_policy(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    stages = ("proposed", "analysis", "impact-review", "independent-ai-audit",
              "human-approval", "implementation", "automated-validation",
              "final-review", "accepted")
    if not nonempty(data.get("version")):
        errors.append("change-approval.json: version is required")
    if data.get("approvalModel") != "review":
        errors.append("change-approval.json: approvalModel must be review")
    if not unique_strings(data.get("requiredStages"), nonempty_list=True):
        errors.append("change-approval.json: requiredStages must be a non-empty unique string array")
    elif tuple(data["requiredStages"]) != stages:
        errors.append("change-approval.json: requiredStages do not match the approved stage order")
    if not unique_strings(data.get("terminalStates"), nonempty_list=True):
        errors.append("change-approval.json: terminalStates must be a non-empty unique string array")
    elif set(data["terminalStates"]) != {"accepted", "rejected", "cancelled"}:
        errors.append("change-approval.json: terminalStates must be accepted, rejected and cancelled")
    if data.get("implementationBranchPolicy") != "feature-branch-only":
        errors.append("change-approval.json: implementationBranchPolicy must be feature-branch-only")
    if not string_list(data.get("rules"), nonempty_list=True):
        errors.append("change-approval.json: rules must be a non-empty string array")
    return errors

def validate_registry_rules(data: dict[str, Any]) -> list[str]:
    if not nonempty(data.get("version")) or not string_list(data.get("rules"), nonempty_list=True):
        return ["registry-rules.json: version and non-empty string rules are required"]
    return []

def validate_system_schema(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if data.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("system-schema.json: expected JSON Schema draft 2020-12")
    if data.get("type") != "object" or data.get("additionalProperties") is not False:
        errors.append("system-schema.json: root must be a closed object schema")
    required = data.get("required")
    properties = data.get("properties")
    if not unique_strings(required, nonempty_list=True) or not isinstance(properties, dict):
        errors.append("system-schema.json: required and properties definitions are invalid")
    elif any(field not in properties for field in required):
        errors.append("system-schema.json: every required field must have a property definition")
    return errors

def main() -> int:
    try:
        data = {name: load(path) for name, path in FILES.items()}
    except ValueError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    errors: list[str] = []
    errors += validate_roles(data["roles"])
    errors += validate_dependencies(data["dependencies"], data["dependency_rules"])
    errors += validate_system_registry(data["registry"], data["ownership"],
                                       data["roles"], data["dependencies"])
    errors += validate_risk_policy(data["risk_policy"])
    errors += validate_approval_policy(data["approval_policy"])
    errors += validate_registry_rules(data["registry_rules"])
    errors += validate_system_schema(data["system_schema"])
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("DUGA governance validation: PASS")
    print(f"Roles: {len(data['roles']['roles'])}; systems: {len(data['registry']['systems'])}; "
          f"dependency edges: {len(data['dependencies']['edges'])}; "
          f"page asset maps: {len(data['dependencies']['pageAssets'])}")
    print("Policies: risk classification, change approval, registry rules and system schema checked.")
    print("LIMITATION: structural/policy consistency only; no runtime authorization is enforced.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
