#!/usr/bin/env python3
"""Static regression checks for DUSS semantic sizing tokens.

This validates source wiring only. It does not render a browser or measure
computed CSS geometry.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise AssertionError(message)


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        fail(f"Missing required file: {path}")
    return target.read_text(encoding="utf-8")


def check_token(css: str, name: str, expected: str) -> None:
    matches = re.findall(
        rf"^\s*{re.escape(name)}\s*:\s*([^;]+);",
        css,
        flags=re.MULTILINE,
    )
    if len(matches) != 1:
        fail(f"{name}: expected exactly one definition, found {len(matches)}")
    actual = matches[0].strip()
    if actual != expected:
        fail(f"{name}: expected {expected!r}, found {actual!r}")


def check_reference(source: str, name: str, path: str) -> None:
    if f"var({name}," not in source:
        fail(f"{path}: missing semantic reference to {name}")


def check_balanced_braces(path: str, source: str) -> None:
    # Strip comments and quoted strings before checking block delimiters.
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.DOTALL)
    source = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', source)
    if source.count("{") != source.count("}"):
        fail(
            f"{path}: unbalanced CSS braces "
            f"({source.count('{')} opening, {source.count('}')} closing)"
        )


def main() -> int:
    tokens = read("assets/sizing/tokens.css")
    token_values = {
        "--duss-icon-size-nav-menu": "1.5rem",
        "--duss-icon-size-search-default": "1.3125rem",
        "--duss-icon-size-auth-field": "1rem",
        "--duss-icon-size-auth-field-compact": "0.875rem",
        "--duss-icon-size-sidebar-logout": "1.375rem",
        "--duss-icon-size-sidebar-glyph": "1.25rem",
        "--duss-icon-size-sidebar-glyph-mobile": "1.1875rem",
        "--duss-icon-size-home-search-mobile": "1.0625rem",
        "--duss-icon-size-home-search-compact": "0.9375rem",
        "--duss-icon-size-admin-search-compact": "1rem",
        "--duss-icon-size-live-search": "0.9375rem",
        "--duss-icon-size-profile-brand": "1.875rem",
        "--duss-icon-size-profile-brand-mobile": "1.6875rem",
        "--duss-icon-size-field-glyph": "0.9375rem",
    }
    for name, value in token_values.items():
        check_token(tokens, name, value)

    source_files = {
        "assets/sizing/tokens.css": tokens,
        "theme.css": read("theme.css"),
        "styles.css": read("styles.css"),
        "live-users.css": read("live-users.css"),
        "profile.css": read("profile.css"),
        "admin.css": read("admin.css"),
        "upload-studio.css": read("upload-studio.css"),
    }
    consumers = {
        "--duss-icon-size-nav-menu": "theme.css",
        "--duss-icon-size-search-default": "theme.css",
        "--duss-icon-size-auth-field": "theme.css",
        "--duss-icon-size-auth-field-compact": "theme.css",
        "--duss-icon-size-sidebar-logout": "theme.css",
        "--duss-icon-size-sidebar-glyph": "theme.css",
        "--duss-icon-size-sidebar-glyph-mobile": "theme.css",
        "--duss-icon-size-home-search-mobile": "theme.css",
        "--duss-icon-size-home-search-compact": "theme.css",
        "--duss-icon-size-admin-search-compact": "theme.css",
        "--duss-icon-size-live-search": "live-users.css",
        "--duss-icon-size-profile-brand": "profile.css",
        "--duss-icon-size-profile-brand-mobile": "profile.css",
        "--duss-icon-size-field-glyph": "styles.css",
    }
    for name, path in consumers.items():
        check_reference(source_files[path], name, path)

    # Guard the previous migrations while this audit advances.
    legacy_families = {
        "role badges": [
            "--duss-role-badge-padding-y",
            "--duss-role-badge-dashboard-padding-y",
            "--duss-role-badge-live-padding-y",
        ],
        "Admin buttons": [
            "--duss-button-admin-padding-y",
            "--duss-button-admin-font-size-mobile",
        ],
    }
    for family, names in legacy_families.items():
        for name in names:
            if not re.search(rf"^\s*{re.escape(name)}\s*:", tokens, re.MULTILINE):
                fail(f"Previously migrated {family} token missing: {name}")

    for path, source in source_files.items():
        check_balanced_braces(path, source)

    pages = [
        "index.html",
        "admin.html",
        "live-users.html",
        "upload-studio.html",
        "profile.html",
    ]
    for path in pages:
        html = read(path)
        match = re.findall(
            r'<link\b[^>]*href=["\']/?assets/sizing/tokens\.css\?v=(duss-[^"\']+)["\'][^>]*>',
            html,
            flags=re.IGNORECASE,
        )
        if match != ["duss-06"]:
            fail(f"{path}: expected one DUSS duss-06 stylesheet link, found {match}")

    spec = read("docs/DUSS-SPEC.md")
    if "Version: 0.6.0" not in spec or "Phase 6 implementation update" not in spec:
        fail("DUSS specification is not aligned with the v0.6 icon-sizing migration")

    print(
        "PASS: 14 icon tokens, 14 selector references, prior badge/button tokens, "
        "7 CSS brace checks, 5 page cache keys, and DUSS v0.6 documentation."
    )
    print("NOTE: Static source verification only; no browser geometry is inferred.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
