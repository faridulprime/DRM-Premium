#!/usr/bin/env python3
"""Focused unit tests for malformed governance input handling."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "validate-duga-registries.py"
spec = importlib.util.spec_from_file_location("duga_validator", MODULE_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def expect_errors(label, fn):
    try:
        errors = fn()
    except Exception as exc:  # A malformed registry must produce errors, not crash.
        raise AssertionError(f"{label}: validator raised {type(exc).__name__}: {exc}") from exc
    if not errors:
        raise AssertionError(f"{label}: malformed input unexpectedly passed")

def main():
    expect_errors("unhashable role kind", lambda: validator.validate_roles({
        "version": "1", "roles": [{"id": "x", "kind": [], "description": "x",
        "permissions": ["read"]}], "separationOfDuties": ["separate"]
    }))
    expect_errors("unhashable edge type", lambda: validator.validate_dependencies({
        "version": "1", "edges": [{"from": "A", "to": "B", "type": [],
        "evidence": "test"}], "pageAssets": [], "caveat": "baseline"
    }, {"version": "1", "rules": ["acyclic"]}))
    expect_errors("unhashable system role", lambda: validator.validate_system_registry({
        "schemaVersion": "1", "registryVersion": "1", "systems": [{
            "id": "SYS", "name": "System", "version": "1.0.0", "status": "active",
            "description": "test", "ownerRole": [], "maintainerRole": "ai-maintainer",
            "auditorRole": "independent-ai-auditor", "paths": ["src/"],
            "dependencies": [], "runtimeCritical": False
        }]
    }, {"version": "1", "assignments": []},
       {"roles": [{"id": "ai-maintainer", "kind": "ai"},
                  {"id": "independent-ai-auditor", "kind": "ai"}]},
       {"edges": [], "pageAssets": []}))
    expect_errors("malformed risk levels", lambda: validator.validate_risk_policy({
        "version": "1", "levels": [{"id": [], "approval": [], "validation": []}],
        "default": "high", "rules": ["do not downgrade"]
    }))
    expect_errors("malformed approval stages", lambda: validator.validate_approval_policy({
        "version": "1", "approvalModel": "review", "requiredStages": [{"stage": "x"}],
        "terminalStates": ["accepted", "rejected", "cancelled"],
        "implementationBranchPolicy": "feature-branch-only", "rules": ["approval"]
    }))
    print("DUGA validator malformed-input tests: PASS (5 cases)")

if __name__ == "__main__":
    main()
