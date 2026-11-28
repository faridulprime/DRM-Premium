#!/usr/bin/env python3
"""DUCS candidate-pair contrast audit; source-level diagnostic, not certification."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
COLOR_FILES = [
    "assets/colors/primitives/palette.css",
    "assets/colors/semantic/foundations.css",
    "assets/colors/components/buttons.css",
    "assets/colors/components/fields.css",
    "assets/colors/components/badges.css",
    "assets/colors/components/surfaces.css",
    "assets/colors/components/feedback.css",
    "assets/colors/states/interaction.css",
]
TOKEN_RE = re.compile(r"(--ducs-[A-Za-z0-9_-]+)\s*:\s*([^;]+);")
VAR_RE = re.compile(r"var\(\s*(--ducs-[A-Za-z0-9_-]+)\s*(?:,\s*([^)]*))?\)")
HEX_RE = re.compile(r"^#([0-9a-fA-F]{3,8})$")
RGB_RE = re.compile(r"^rgba?\((.*)\)$", re.IGNORECASE)


@dataclass(frozen=True)
class Pair:
    label: str
    foreground: str
    background: str
    minimum: float = 4.5
    background_base: str | None = None


PAIRS = [
    Pair("foundation primary / canvas", "--ducs-text-primary", "--ducs-bg-canvas"),
    Pair("foundation primary / subtle canvas", "--ducs-text-primary", "--ducs-bg-subtle"),
    Pair("foundation primary / base surface", "--ducs-text-primary", "--ducs-surface-base"),
    Pair("foundation primary / raised surface", "--ducs-text-primary", "--ducs-surface-raised"),
    Pair("foundation primary / sunken surface", "--ducs-text-primary", "--ducs-surface-sunken"),
    Pair("foundation secondary / canvas", "--ducs-text-secondary", "--ducs-bg-canvas"),
    Pair("foundation secondary / base surface", "--ducs-text-secondary", "--ducs-surface-base"),
    Pair("foundation muted / canvas", "--ducs-text-muted", "--ducs-bg-canvas"),
    Pair("foundation muted / base surface", "--ducs-text-muted", "--ducs-surface-base"),
    Pair("primary action / canvas", "--ducs-action-primary", "--ducs-bg-canvas"),
    Pair("primary action hover / canvas", "--ducs-action-primary-hover", "--ducs-bg-canvas"),
    Pair("danger action / canvas", "--ducs-action-danger", "--ducs-bg-canvas"),
    Pair("icon secondary / canvas", "--ducs-icon-secondary", "--ducs-bg-canvas"),
    Pair("focus ring / canvas", "--ducs-focus-ring", "--ducs-bg-canvas", 3.0),
    Pair("default border / canvas", "--ducs-border-default", "--ducs-bg-canvas", 3.0),
    Pair("strong border / base surface", "--ducs-border-strong", "--ducs-surface-base", 3.0),

    Pair("primary button text / normal", "--ducs-button-primary-text", "--ducs-button-primary-bg"),
    Pair("primary button text / hover", "--ducs-button-primary-text", "--ducs-button-primary-hover-bg"),
    Pair("secondary button text / raised", "--ducs-button-secondary-text", "--ducs-button-secondary-bg"),
    Pair("secondary button border / raised", "--ducs-button-secondary-border", "--ducs-button-secondary-bg", 3.0),
    Pair("admin login button text / button", "--ducs-admin-login-button-text", "--ducs-admin-login-button-bg"),

    Pair("semantic field text / background", "--ducs-field-text", "--ducs-field-bg"),
    Pair("semantic field placeholder / background", "--ducs-field-placeholder", "--ducs-field-bg"),
    Pair("semantic field border / background", "--ducs-field-border", "--ducs-field-bg", 3.0),
    Pair("semantic focus border / background", "--ducs-field-border-focus", "--ducs-field-bg", 3.0),
    Pair("Live Users field text / background", "--ducs-live-field-text", "--ducs-live-field-bg"),
    Pair("Live Users placeholder / background", "--ducs-live-field-placeholder", "--ducs-live-field-bg"),
    Pair("Admin login field text / background", "--ducs-admin-login-field-text", "--ducs-admin-login-field-bg"),
    Pair("Admin login placeholder / background", "--ducs-admin-login-placeholder", "--ducs-admin-login-field-bg"),
    Pair("Admin login label / panel", "--ducs-admin-login-label", "--ducs-admin-card-bg"),
    Pair("shared auth placeholder / field", "--ducs-shell-auth-placeholder", "--ducs-shell-auth-field-bg"),
    Pair("shared search placeholder / field", "--ducs-shell-search-placeholder", "--ducs-shell-search-bg"),
    Pair("Profile field text / background", "--ducs-profile-field-text", "--ducs-profile-field-bg"),
    Pair("Profile field placeholder / background", "--ducs-profile-field-placeholder", "--ducs-profile-field-bg"),
    Pair("Upload field text / input background", "--ducs-upload-field-text", "--ducs-upload-input-bg"),
    Pair("Upload field label / panel", "--ducs-upload-field-label", "--ducs-upload-panel-bg"),

    Pair("success badge text / alpha background", "--ducs-badge-success-text", "--ducs-badge-success-bg", 4.5, "--ducs-surface-base"),
    Pair("warning badge text / alpha background", "--ducs-badge-warning-text", "--ducs-badge-warning-bg", 4.5, "--ducs-surface-base"),
    Pair("danger badge text / alpha background", "--ducs-badge-danger-text", "--ducs-badge-danger-bg", 4.5, "--ducs-surface-base"),
    Pair("info badge text / alpha background", "--ducs-badge-info-text", "--ducs-badge-info-bg", 4.5, "--ducs-surface-base"),
    Pair("Admin owner badge text / alpha background", "--ducs-admin-owner-text", "--ducs-admin-owner-bg", 4.5, "--ducs-admin-card-bg"),
    Pair("shared admin badge text / alpha background", "--ducs-shell-admin-badge-text", "--ducs-shell-admin-badge-bg", 4.5, "--ducs-shell-header-bg"),
    Pair("shared role owner text / alpha background", "--ducs-shell-role-owner-text", "--ducs-shell-role-owner-bg", 4.5, "--ducs-shell-profile-menu-bg"),
    Pair("shared role admin text / alpha background", "--ducs-shell-role-admin-text", "--ducs-shell-role-admin-bg", 4.5, "--ducs-shell-profile-menu-bg"),
    Pair("shared role member text / alpha background", "--ducs-shell-role-member-text", "--ducs-shell-role-member-bg", 4.5, "--ducs-shell-profile-menu-bg"),

    Pair("Live Users primary text / page", "--ducs-live-text", "--ducs-live-page-bg"),
    Pair("Live Users secondary text / page", "--ducs-live-text-secondary", "--ducs-live-page-bg"),
    Pair("Live Users muted text / page", "--ducs-live-text-muted", "--ducs-live-page-bg"),
    Pair("Live Users subtle text / page", "--ducs-live-text-subtle", "--ducs-live-page-bg"),
    Pair("Live Users row text / page", "--ducs-live-row-text", "--ducs-live-page-bg"),
    Pair("Live Users list metadata / row", "--ducs-live-list-meta", "--ducs-live-surface-raised"),
    Pair("Live Users dialog text / dialog", "--ducs-live-dialog-text", "--ducs-live-dialog-bg"),
    Pair("Live Users dialog close text / close", "--ducs-live-dialog-close-text", "--ducs-live-dialog-close-bg"),
    Pair("Live Users notice text / notice", "--ducs-live-notice-text", "--ducs-live-notice-bg"),
    Pair("Live Users owner role / owner badge", "--ducs-live-owner-text", "--ducs-live-owner-bg"),
    Pair("Live Users admin drawer role / gradient start", "--ducs-live-admin-text", "--ducs-live-modal-gradient-start"),
    Pair("Live Users admin drawer role / gradient mid", "--ducs-live-admin-text", "--ducs-live-modal-gradient-mid"),
    Pair("Live Users admin drawer role / gradient end", "--ducs-live-admin-text", "--ducs-live-modal-gradient-end"),
    Pair("Live Users restricted drawer role / gradient start", "--ducs-live-restricted-text", "--ducs-live-modal-gradient-start"),
    Pair("Live Users restricted drawer role / gradient mid", "--ducs-live-restricted-text", "--ducs-live-modal-gradient-mid"),
    Pair("Live Users restricted drawer role / gradient end", "--ducs-live-restricted-text", "--ducs-live-modal-gradient-end"),
    Pair("Live Users warning text / surface", "--ducs-live-warning-text", "--ducs-live-surface"),
    Pair("Live Users active restriction tab / active surface", "--ducs-live-tab-active-text", "--ducs-live-tab-active-bg"),
    Pair("Live Users active count / badge", "--ducs-live-tab-active-count-text", "--ducs-live-tab-active-count-bg"),
    Pair("Live Users back link hover / topbar surface", "--ducs-live-back-link-hover", "--ducs-live-surface"),
    Pair("Live Users drawer action hover / active surface", "--ducs-live-drawer-action-hover-text", "--ducs-live-surface-active"),
    Pair("Live Users drawer kicker / drawer", "--ducs-shell-profile-drawer-kicker", "--ducs-shell-profile-drawer-bg-mid"),
    Pair("Live Users drawer muted name / drawer", "--ducs-shell-profile-drawer-name-muted", "--ducs-shell-profile-drawer-bg-mid"),
    Pair("Live Users drawer detail label / drawer", "--ducs-shell-profile-drawer-detail-label", "--ducs-shell-profile-drawer-bg-mid"),
    Pair("Live Users drawer detail value / drawer", "--ducs-shell-profile-drawer-detail-text", "--ducs-shell-profile-drawer-bg-mid"),
    Pair("Live Users drawer footer / drawer", "--ducs-shell-profile-drawer-footer-text", "--ducs-shell-profile-drawer-bg-mid"),

    Pair("Profile heading / card start", "--ducs-profile-heading", "--ducs-profile-card-bg-start"),
    Pair("Profile heading / card end", "--ducs-profile-heading", "--ducs-profile-card-bg-end"),
    Pair("Profile label / card start", "--ducs-profile-label", "--ducs-profile-card-bg-start"),
    Pair("Profile muted text / card start", "--ducs-profile-muted", "--ducs-profile-card-bg-start"),
    Pair("Profile muted text / card end", "--ducs-profile-muted", "--ducs-profile-card-bg-end"),
    Pair("Profile brand / topbar", "--ducs-profile-brand-text", "--ducs-profile-topbar-bg", 4.5, "--ducs-live-page-bg"),
    Pair("Profile success text / card", "--ducs-profile-status-success", "--ducs-profile-card-bg-start"),
    Pair("Profile error text / card", "--ducs-profile-status-error", "--ducs-profile-card-bg-start"),
    Pair("Upload brand / header", "--ducs-upload-brand-text", "--ducs-upload-header-bg"),
    Pair("Upload heading / panel", "--ducs-upload-heading-text", "--ducs-upload-panel-bg"),
    Pair("Upload muted text / panel", "--ducs-upload-muted-text", "--ducs-upload-panel-bg"),
    Pair("Upload soft text / panel", "--ducs-upload-soft-text", "--ducs-upload-panel-bg"),
    Pair("Upload muted accent / panel", "--ducs-upload-muted-accent", "--ducs-upload-panel-bg"),
    Pair("Upload success text / panel", "--ducs-upload-success-text", "--ducs-upload-panel-bg"),
    Pair("Upload error text / error notice", "--ducs-upload-notice-error-text", "--ducs-upload-notice-error-bg"),

    Pair("Homepage brand / page", "--ducs-home-brand-text", "--ducs-home-page-bg"),
    Pair("Homepage muted text / page", "--ducs-home-muted-text", "--ducs-home-page-bg"),
    Pair("Homepage nav / header", "--ducs-home-nav-text", "--ducs-home-header-bg", 4.5, "--ducs-home-page-bg"),
    Pair("Homepage hero / hero surface", "--ducs-home-hero-text", "--ducs-home-hero-bg"),
    Pair("Homepage footer / page", "--ducs-home-footer-text", "--ducs-home-page-bg"),
    Pair("Homepage card muted / card", "--ducs-home-card-muted", "--ducs-home-card-bg"),
    Pair("Homepage editor text / editor button", "--ducs-home-editor-text", "--ducs-home-editor-button-bg"),
    Pair("Homepage editor text / editor panel", "--ducs-home-editor-text", "--ducs-home-editor-panel-bg"),
    Pair("Homepage builder text / builder button", "--ducs-home-builder-text", "--ducs-home-builder-button-bg"),
    Pair("Homepage builder text / builder background", "--ducs-home-builder-text", "--ducs-home-builder-bg"),
    Pair("Homepage active category text / active chip", "--ducs-shell-category-chip-active-text", "--ducs-shell-category-chip-active-bg"),
    Pair("Homepage registration text / gradient start", "--ducs-home-register-text", "--ducs-home-register-bg-start"),
    Pair("Homepage registration text / gradient mid", "--ducs-home-register-text", "--ducs-home-register-bg-mid"),
    Pair("Homepage registration text / gradient end", "--ducs-home-register-text", "--ducs-home-register-bg-end"),
    Pair("Homepage profilebar text / gradient start", "--ducs-home-profilebar-text", "--ducs-home-profilebar-bg-start"),
    Pair("Homepage profilebar text / gradient end", "--ducs-home-profilebar-text", "--ducs-home-profilebar-bg-end"),

    Pair("Live dialog border / dialog", "--ducs-live-dialog-border", "--ducs-live-dialog-bg", 3.0),
    Pair("Upload panel border / panel", "--ducs-upload-panel-border", "--ducs-upload-panel-bg", 3.0),
    Pair("Profile card border / card start", "--ducs-profile-card-border", "--ducs-profile-card-bg-start", 3.0),
    Pair("Admin button border / button", "--ducs-admin-button-border", "--ducs-admin-login-button-bg", 3.0),
]


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.is_file():
        raise AssertionError(f"Missing DUCS source file: {path}")
    return file_path.read_text(encoding="utf-8")


def collect_tokens() -> dict[str, str]:
    tokens: dict[str, str] = {}
    conflicts: list[str] = []
    for path in COLOR_FILES:
        for name, value in TOKEN_RE.findall(read(path)):
            value = value.strip()
            if name in tokens and tokens[name] != value:
                conflicts.append(f"{name}: {tokens[name]!r} vs {value!r} ({path})")
            tokens[name] = value
    if conflicts:
        raise AssertionError("Conflicting token declarations:\n" + "\n".join(conflicts))
    return tokens


def resolve_token(name: str, tokens: dict[str, str], stack: tuple[str, ...] = ()) -> str:
    if name in stack:
        raise AssertionError("Circular DUCS variable reference: " + " -> ".join(stack + (name,)))
    if name not in tokens:
        raise AssertionError(f"Undefined DUCS token: {name}")
    value = tokens[name]
    matches = list(VAR_RE.finditer(value))
    if not matches:
        return value.strip()
    if len(matches) != 1 or matches[0].span() != (0, len(value)):
        raise AssertionError(f"Unsupported composite var() expression in {name}: {value!r}")
    match = matches[0]
    target, fallback = match.group(1), match.group(2)
    if target not in tokens:
        if fallback is None:
            raise AssertionError(f"{name} references missing token {target}")
        return fallback.strip()
    return resolve_token(target, tokens, stack + (name,))


def parse_color(value: str) -> tuple[float, float, float, float]:
    value = value.strip()
    hm = HEX_RE.fullmatch(value)
    if hm:
        raw = hm.group(1)
        if len(raw) in (3, 4):
            channels = [int(ch * 2, 16) for ch in raw[:3]]
            alpha = int(raw[3] * 2, 16) / 255 if len(raw) == 4 else 1.0
        elif len(raw) in (6, 8):
            channels = [int(raw[i:i + 2], 16) for i in (0, 2, 4)]
            alpha = int(raw[6:8], 16) / 255 if len(raw) == 8 else 1.0
        else:
            raise AssertionError(f"Unsupported hex color length: {value}")
        return channels[0], channels[1], channels[2], alpha
    rm = RGB_RE.fullmatch(value)
    if rm:
        parts = [part for part in re.split(r"[,/\s]+", rm.group(1).strip()) if part]
        if len(parts) not in (3, 4):
            raise AssertionError(f"Unsupported rgb() syntax: {value}")
        channels = [
            float(part[:-1]) * 2.55 if part.endswith("%") else float(part)
            for part in parts[:3]
        ]
        alpha_part = parts[3] if len(parts) == 4 else "1"
        alpha = float(alpha_part[:-1]) / 100 if alpha_part.endswith("%") else float(alpha_part)
        if not all(0 <= ch <= 255 for ch in channels) or not 0 <= alpha <= 1:
            raise AssertionError(f"Color channel out of range: {value}")
        return channels[0], channels[1], channels[2], alpha
    raise AssertionError(f"Unsupported color value: {value!r}")


def composite(foreground, background):
    fr, fg, fb, fa = foreground
    br, bg, bb, ba = background
    out_a = fa + ba * (1 - fa)
    if out_a <= 0:
        return 0.0, 0.0, 0.0, 0.0
    out = tuple(
        (fc * fa + bc * ba * (1 - fa)) / out_a
        for fc, bc in ((fr, br), (fg, bg), (fb, bb))
    )
    return out[0], out[1], out[2], out_a


def linear_channel(value: float) -> float:
    value /= 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(color) -> float:
    red, green, blue, _alpha = color
    r, g, b = (linear_channel(channel) for channel in (red, green, blue))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(foreground, background) -> float:
    ratios = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (ratios[0] + 0.05) / (ratios[1] + 0.05)


def render_pair(pair: Pair, tokens: dict[str, str]) -> float:
    foreground = parse_color(resolve_token(pair.foreground, tokens))
    background = parse_color(resolve_token(pair.background, tokens))
    if background[3] < 1:
        if pair.background_base is None:
            raise AssertionError(f"{pair.label}: translucent background has no compositing base")
        background = composite(background, parse_color(resolve_token(pair.background_base, tokens)))
    if foreground[3] < 1:
        foreground = composite(foreground, background)
    if background[3] < 1 or foreground[3] < 1:
        raise AssertionError(f"{pair.label}: color remained translucent")
    return contrast(foreground, background)


def main() -> int:
    tokens = collect_tokens()
    results = []
    for pair in PAIRS:
        results.append((pair, render_pair(pair, tokens)))
    passed = [(p, r) for p, r in results if r + 0.005 >= p.minimum]
    review = [(p, r) for p, r in results if r + 0.005 < p.minimum]
    print(
        f"DUCS contrast source audit: {len(results)} explicit foreground/background candidates; "
        f"{len(passed)} meet their selected threshold; {len(review)} need review."
    )
    for pair, ratio in review:
        print(
            f"REVIEW: {pair.label}: {ratio:.2f}:1 "
            f"(target {pair.minimum:.1f}:1; {pair.foreground} on {pair.background})"
        )
    if not review:
        print("PASS: all registered contrast candidates meet their selected thresholds.")
    else:
        print(
            "NOTE: below-target pairs are diagnostic findings, not automatic token changes. "
            "Confirm rendered context before remediation."
        )
    print(
        "LIMITATION: explicit source-level candidates only; not a full rendered WCAG audit. "
        "Gradient endpoints are checked individually; image/texture backgrounds and runtime overrides are excluded."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
