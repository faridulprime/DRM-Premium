#!/usr/bin/env python3
"""Static guard for DUGA disposable D1 target identity drift.

This checks repository strings only. It never contacts Cloudflare or executes SQL.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

V1_NAME = "drm-duga-acceptance-disposable"
V1_ID = "6d512429-34a3-498b-9430-45f11d382da9"
V2_NAME = "drm-duga-acceptance-v2-disposable"
V2_ID = "716a4f20-25a5-4a59-9dd2-c764b193f385"
PREVIEW_ID = "6821a135-9330-4537-9cf8-eb9ca90970b8"


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"Missing required file: {relative}")
    return path.read_text(encoding="utf-8")


def one(pattern: str, source: str, label: str) -> str:
    values = re.findall(pattern, source, flags=re.MULTILINE)
    if len(values) != 1:
        raise AssertionError(f"{label}: expected one match, found {len(values)}")
    return values[0]


def main() -> int:
    worker_toml = read("scripts/duga-d1-acceptance-worker/wrangler.toml")
    worker_readme = read("scripts/duga-d1-acceptance-worker/README.md")
    revised_probes = read("scripts/duga-d1-revised-gap-probes.sql")
    readiness = read("docs/DUGA-API-INTEGRATION-READINESS.md")
    registry = read("docs/DUGA-D1-TARGET-REGISTRY.md")

    configured_name = one(r'^database_name\s*=\s*"([^"]+)"\s*$', worker_toml, "Wrangler database_name")
    configured_id = one(r'^database_id\s*=\s*"([^"]+)"\s*$', worker_toml, "Wrangler database_id")
    if (configured_name, configured_id) != (V1_NAME, V1_ID):
        raise AssertionError(
            f"Checked-in Worker target changed unexpectedly: {configured_name}/{configured_id}"
        )
    if V1_NAME not in worker_readme or V1_ID not in worker_readme:
        raise AssertionError("Worker README does not match its checked-in v1 Wrangler target.")
    if V2_NAME not in revised_probes or V2_ID not in revised_probes:
        raise AssertionError("Revised SQL probes do not declare their v2 target.")
    if V1_ID in revised_probes:
        raise AssertionError("Revised v2 probe file unexpectedly contains the v1 database ID.")
    if V2_NAME not in readiness or V2_NAME not in registry:
        raise AssertionError("Owner-supplied v2 Worker/database reference is not recorded.")
    if V1_ID not in registry or V2_ID not in registry or PREVIEW_ID not in registry:
        raise AssertionError("Target registry is missing one of the recorded database identities.")
    if V1_ID == V2_ID or V2_ID == PREVIEW_ID or V1_ID == PREVIEW_ID:
        raise AssertionError("Disposable and Preview target IDs must remain distinct.")
    if "legacy v1" not in worker_readme.lower():
        raise AssertionError("Worker README must label the checked-in target as legacy v1.")
    if "does not target v2" not in worker_readme.lower():
        raise AssertionError("Worker README must warn that Wrangler deployment does not target v2.")
    if "identity warning" not in revised_probes.lower():
        raise AssertionError("Revised gap probes must carry a target identity warning.")

    print("DUGA disposable D1 target registry: PASS")
    print(f"Checked-in Worker config: v1 {configured_name} ({configured_id})")
    print(f"Revised manual probes: v2 {V2_NAME} ({V2_ID})")
    print("Preview target remains a separate, non-test database.")
    print("LIMITATION: repository identity checks only; no Cloudflare account or binding was queried.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
