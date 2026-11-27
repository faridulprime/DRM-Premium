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


def check_selector_icon_token(
    source: str,
    selector: str,
    token: str,
    expected_blocks: int = 1,
    properties: tuple = ("width", "height"),
) -> None:
    pattern = re.compile(re.escape(selector) + r"\s*\{([^{}]*)\}")
    blocks = pattern.findall(source)
    matching = []
    for block in blocks:
        has_dimensions = all(
            re.search(
                rf"(?:^|;)\s*{prop}\s*:\s*var\({re.escape(token)}\s*,",
                block,
            )
            for prop in properties
        )
        if has_dimensions:
            matching.append(block)
    if len(matching) != expected_blocks:
        fail(
            f"{selector}: expected {expected_blocks} block(s) using {token} "
            f"for the requested properties, found {len(matching)} of {len(blocks)}"
        )


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
    if not tokens.startswith("/* DRM Universal Sizing System (DUSS) — v0.8.0"):
        fail("DUSS token stylesheet header is not versioned v0.8.0")
    if "DUSS v0.7 — audited component variants and icon slots." not in tokens:
        fail("DUSS v0.7 component-variant section marker is missing")
    if "DUSS v0.8 — 44px interactive-target consumer foundation" not in tokens:
        fail("DUSS v0.8 interactive-target marker is missing")
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
        "--duss-icon-size-live-role": "0.6875rem",
        "--duss-icon-size-profile-drawer-logout": "0.9375rem",
        "--duss-icon-size-profile-complete-brand": "1rem",
        "--duss-icon-size-profile-complete-brand-mobile": "0.875rem",
        "--duss-icon-slot-size-live-drawer-action": "1.4375rem",
        "--duss-icon-size-live-drawer-action": "0.75rem",
    }
    for name, value in token_values.items():
        check_token(tokens, name, value)
    check_token(tokens, "--duss-touch-target-min", "2.75rem")

    source_files = {
        "assets/sizing/tokens.css": tokens,
        "assets/sizing/touch-targets.css": read("assets/sizing/touch-targets.css"),
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
        "--duss-icon-size-live-role": "live-users.css",
        "--duss-icon-size-profile-drawer-logout": "theme.css",
        "--duss-icon-size-profile-complete-brand": "styles.css",
        "--duss-icon-size-profile-complete-brand-mobile": "styles.css",
        "--duss-icon-slot-size-live-drawer-action": "live-users.css",
        "--duss-icon-size-live-drawer-action": "live-users.css",
    }
    if set(token_values) != set(consumers):
        missing = sorted(set(token_values) - set(consumers))
        extra = sorted(set(consumers) - set(token_values))
        fail(f"Token/consumer registry mismatch; missing consumers={missing}, unknown consumers={extra}")
    for name, path in consumers.items():
        check_reference(source_files[path], name, path)
    check_reference(
        source_files["assets/sizing/touch-targets.css"],
        "--duss-touch-target-min",
        "assets/sizing/touch-targets.css",
    )
    if not re.search(
        r"#newVideo\s*\{[^}]*min-block-size\s*:\s*var\(--duss-touch-target-min\s*,",
        source_files["assets/sizing/touch-targets.css"],
        flags=re.DOTALL,
    ):
        fail("Admin New Video action does not consume the 44px DUSS touch-target token")
    if not re.search(
        r"\.home-page \.topbar \.account-controls #profileMenuToggle,\\s*\\.profile-drawer \.profile-drawer-close\\s*\\{[^}]*inline-size\\s*:\\s*var\\(--duss-touch-target-min\\s*,",
        source_files["assets/sizing/touch-targets.css"],
        flags=re.DOTALL,
    ):
        fail("Homepage Profile Drawer opener/close controls do not consume the 44px DUSS target")
    live_users_js = read("live-users.js")
    if 'class="live-error-link"' not in live_users_js:
        fail("Live Users fallback dashboard link is missing its DUSS touch-target class")

    check_selector_icon_token(
        source_files["admin.css"], ".admin-topbar .admin-search svg",
        "--duss-icon-size-admin-search-compact"
    )
    check_selector_icon_token(
        source_files["theme.css"], ".home-page .side-icon",
        "--duss-nav-icon-size", properties=("width", "flex-basis")
    )

    # Every matching selector block in these variants must use the semantic token.
    check_selector_icon_token(
        source_files["theme.css"], ".home-page .yt-search svg",
        "--duss-icon-size-home-search-compact", expected_blocks=2
    )
    check_selector_icon_token(
        source_files["theme.css"], ".admin-topbar .admin-search svg",
        "--duss-icon-size-admin-search-compact", expected_blocks=2
    )
    check_selector_icon_token(
        source_files["theme.css"], ".profile-drawer .profile-drawer-logout-button svg",
        "--duss-icon-size-profile-drawer-logout"
    )
    check_selector_icon_token(
        source_files["live-users.css"], ".live-role svg",
        "--duss-icon-size-live-role"
    )
    check_selector_icon_token(
        source_files["profile.css"], ".profile-brand svg",
        "--duss-icon-size-profile-brand"
    )
    check_selector_icon_token(
        source_files["profile.css"], ".profile-brand svg",
        "--duss-icon-size-profile-brand-mobile"
    )

    check_selector_icon_token(source_files["styles.css"], ".profile-brand-mark", "--duss-icon-size-profile-complete-brand")
    check_selector_icon_token(source_files["styles.css"], ".profile-brand-mark", "--duss-icon-size-profile-complete-brand-mobile")
    check_selector_icon_token(source_files["live-users.css"], ".live-drawer-action .action-symbol", "--duss-icon-slot-size-live-drawer-action")
    check_selector_icon_token(source_files["live-users.css"], ".live-drawer-action .action-symbol", "--duss-icon-size-live-drawer-action", properties=("font-size",))

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
        if match != ["duss-08"]:
            fail(f"{path}: expected one DUSS duss-08 stylesheet link, found {match}")
        touch_link = 'href="/assets/sizing/touch-targets.css?v=duss-08"'
        if html.count(touch_link) != 1:
            fail(f"{path}: expected one DUSS touch-target duss-08 stylesheet link")

    spec = read("docs/DUSS-SPEC.md")
    if "Version: 0.8.0" not in spec or "Phase 8 implementation update" not in spec:
        fail("DUSS specification is not aligned with the v0.8 touch-target migration")

    print(
        f"PASS: {len(token_values)} icon/slot tokens, {len(consumers)} selector references, "
        "all audited duplicate overrides, profile-banner and Live Users drawer variants, "
        "mobile nav slot, prior badge/button tokens, 8 CSS brace checks, "
        "the 44px touch-target contract, 5 page cache keys, and DUSS v0.8 documentation."
    )
    print("NOTE: Static source verification only; no browser geometry is inferred.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
