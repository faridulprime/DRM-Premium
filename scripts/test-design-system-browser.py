#!/usr/bin/env python3
"""Browser-level regression checks for DRM's four universal design systems.

This runs the checked-out static site locally. It does not exercise Cloudflare
Pages Functions, D1, authenticated workflows, or a deployed environment.
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys
from threading import Thread
from urllib.parse import urlsplit
from time import sleep

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "homepage": ("/", "#menuToggle", "#ytSidebar", "#sidebarBackdrop", True),
    "movies": ("/movies", "#menuToggle", "#ytSidebar", "#sidebarBackdrop", True),
    "admin": ("/admin.html", "#adminMenuToggle", "#adminSidebar", "#adminSidebarBackdrop", True),
    "live-users": ("/live-users.html", "#liveMenuToggle", "#liveSidebar", "#liveSidebarBackdrop", True),
    "upload-studio": ("/upload-studio.html", "#studioMenuToggle", "#liveSidebar", "#liveSidebarBackdrop", True),
    "profile": ("/profile.html", None, None, None, False),
}
VIEWPORTS = [
    ("desktop", 1440, 900),
    ("tablet", 900, 1024),
    ("mobile", 390, 844),
    ("narrow-mobile", 320, 780),
    # 720 CSS px is the layout-viewport equivalent of a 1440px desktop at
    # 200% browser zoom. It is a stress proxy, not a real browser zoom test.
    ("zoom-200-layout-proxy", 720, 900),
    ("breakpoint-760", 760, 900),
    ("breakpoint-761", 761, 900),
]
SYSTEM_STYLES = {
    "DUSS": "/assets/sizing/tokens.css",
    "DUPS": "/assets/positioning/tokens.css",
    "DUCS": "/assets/colors/index.css",
}
ROOT_TOKENS = {
    "--duss-header-height-desktop": "DUSS",
    "--dups-layer-page-header": "DUPS",
    "--ducs-bg-canvas": "DUCS",
    "--ducs-text-primary": "DUCS",
    "--ducs-text-secondary": "DUCS",
    "--ducs-action-primary": "DUCS",
    "--ducs-border-default": "DUCS",
}
FAILURES: list[str] = []
WARNINGS: list[str] = []
STACKING_CONTEXT_AUDIT: dict[str, dict] = {}


def fail(message: str) -> None:
    FAILURES.append(message)


def parse_color(value: str):
    value = value.strip().lower()
    if re.fullmatch(r"#[0-9a-f]{3}", value):
        return tuple(int(ch * 2, 16) for ch in value[1:])
    if re.fullmatch(r"#[0-9a-f]{6}", value):
        return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))
    match = re.fullmatch(
        r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*[\d.]+%?)?\s*\)",
        value,
    )
    if match:
        return tuple(round(float(match.group(i))) for i in (1, 2, 3))
    return None


def luminance(rgb):
    def channel(value):
        value /= 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    red, green, blue = (channel(v) for v in rgb)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(foreground, background):
    a, b = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (a + 0.05) / (b + 0.05)


class QuietHandler(SimpleHTTPRequestHandler):
    """Static test server with Cloudflare Pages-style extensionless HTML routes."""
    def translate_path(self, path):
        translated = super().translate_path(path)
        url_path = urlsplit(path).path
        if url_path.endswith("/") or Path(url_path).suffix:
            return translated
        html_candidate = Path(translated + ".html")
        if html_candidate.is_file():
            return str(html_candidate)
        return translated

    def log_message(self, _format, *_args):
        pass


def serve():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def inspect_page(browser, base_url, name, route, viewport_name, width, height):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        locale="bn-BD",
        is_mobile=width <= 760,
        has_touch=width <= 760,
        reduced_motion="no-preference",
    )
    context.route("https://**/*", lambda request_route: request_route.abort())
    page = context.new_page()
    asset_errors = []
    page.on(
        "response",
        lambda response: asset_errors.append(f"{response.status} {response.url}")
        if response.url.startswith(base_url)
        and response.status >= 400
        and re.search(r"\.(?:css|js)(?:\?|$)", response.url)
        else None,
    )
    try:
        response = page.goto(base_url + route, wait_until="load", timeout=30000)
        if response is None or response.status != 200:
            fail(f"{name}/{viewport_name}: page response was {None if response is None else response.status}")
            return
        page.wait_for_timeout(100)

        if not page.title().strip():
            fail(f"{name}/{viewport_name}: empty document title")

        accessibility_names = page.evaluate(
            """() => {
              const visible = el => !el.closest("[hidden],[inert]") &&
                getComputedStyle(el).display !== "none" &&
                getComputedStyle(el).visibility !== "hidden" &&
                el.getClientRects().length > 0;
              const accessibleName = el => {
                const labelledBy = el.getAttribute("aria-labelledby");
                const labelledText = labelledBy ? labelledBy.split(/\\s+/).map(id => document.getElementById(id)?.innerText || "").join(" ").trim() : "";
                return (el.getAttribute("aria-label") || labelledText || el.getAttribute("title") ||
                  el.innerText || el.value || "").replace(/\\s+/g, " ").trim();
              };
              const controls = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"]')]
                .filter(el => visible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
              const unnamed = controls.filter(el => {
                if (el.matches("input,select,textarea")) {
                  if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.labels?.length) return false;
                  return !el.getAttribute("title");
                }
                return !accessibleName(el);
              }).map(el => ({tag:el.tagName.toLowerCase(),id:el.id,className:typeof el.className==="string"?el.className:""}));
              const dialogs = [...document.querySelectorAll('dialog,[role="dialog"],[role="alertdialog"]')];
              const unnamedDialogs = dialogs.filter(el => {
                const labelledBy = el.getAttribute("aria-labelledby");
                const label = el.getAttribute("aria-label");
                const labelledText = labelledBy ? labelledBy.split(/\\s+/).map(id => document.getElementById(id)?.innerText || "").join(" ").trim() : "";
                const heading = el.querySelector("h1,h2,h3,h4,h5,h6");
                return !(label?.trim() || labelledText || heading?.innerText?.trim());
              }).map(el => el.id || el.className || el.tagName);
              return {unnamed,unnamedDialogs};
            }"""
        )
        if accessibility_names["unnamed"]:
            fail(f"{name}/{viewport_name}: visible interactive controls lack an accessible name: {accessibility_names['unnamed'][:8]}")
        if accessibility_names["unnamedDialogs"]:
            fail(f"{name}/{viewport_name}: dialog surfaces lack an accessible name: {accessibility_names['unnamedDialogs']}")

        if name == "admin":
            admin_tabs = page.evaluate(
                """() => [...document.querySelectorAll("[data-tab]")].map(el => ({
                  tab: el.dataset.tab, role: el.getAttribute("role"),
                  selected: el.getAttribute("aria-selected"), pressed: el.getAttribute("aria-pressed"),
                  tabindex: el.getAttribute("tabindex"), controls: el.getAttribute("aria-controls"),
                  exists: !!document.getElementById(el.getAttribute("aria-controls") || "")
                }))"""
            )
            for item in admin_tabs:
                state_ok = item["selected"] in ("true", "false") if item["role"] == "tab" else item["pressed"] in ("true", "false")
                if not state_ok or not item["controls"] or not item["exists"]:
                    fail(f"admin/{viewport_name}: dashboard navigation lacks an accessible selected state or panel relationship ({item})")
                if item["role"] == "tab" and item["tabindex"] not in ("0", "-1"):
                    fail(f"admin/{viewport_name}: dashboard tab does not use roving tabindex ({item})")
            if not any(item["tab"] == "overview" and ((item["role"] == "tab" and item["selected"] == "true") or (item["role"] != "tab" and item["pressed"] == "true")) for item in admin_tabs):
                fail(f"admin/{viewport_name}: Overview is not exposed as the initially selected dashboard view")
            if viewport_name == "desktop":
                page.locator("#dashboard").evaluate("(el) => { el.hidden = false; }")
                page.locator("#adminCategoryBar").evaluate("(el) => { el.hidden = false; }")
                page.locator("#adminMenuToggle").click()
                page.wait_for_function(
                    "() => document.body.classList.contains('sidebar-open') && getComputedStyle(document.querySelector('#adminSidebar')).visibility === 'visible'",
                    timeout=2500,
                )
                page.locator("#adminSideTabOverview").focus()
                page.keyboard.press("ArrowDown")
                page.wait_for_function("() => document.querySelector('#adminSideTabVideos')?.getAttribute('aria-selected') === 'true' && document.activeElement?.id === 'adminMenuToggle'", timeout=2500)

                page.locator("#adminMenuToggle").click()
                page.wait_for_function(
                    "() => document.body.classList.contains('sidebar-open') && getComputedStyle(document.querySelector('#adminSidebar')).visibility === 'visible'",
                    timeout=2500,
                )
                page.locator("#adminSideTabVideos").focus()
                page.keyboard.press("End")
                page.wait_for_function("() => document.querySelector('#adminSideTabCategories')?.getAttribute('aria-selected') === 'true' && document.activeElement?.id === 'adminMenuToggle'", timeout=2500)

                page.locator("#adminMenuToggle").click()
                page.wait_for_function(
                    "() => document.body.classList.contains('sidebar-open') && getComputedStyle(document.querySelector('#adminSidebar')).visibility === 'visible'",
                    timeout=2500,
                )
                page.locator("#adminSideTabCategories").focus()
                page.keyboard.press("Home")
                page.wait_for_function("() => document.querySelector('#adminSideTabOverview')?.getAttribute('aria-selected') === 'true' && document.activeElement?.id === 'adminMenuToggle'", timeout=2500)

                page.locator('#adminCategoryBar button[data-tab="videos"]').evaluate("(el) => el.click()")
                page.wait_for_function(
                    "() => document.querySelector('#adminCategoryBar button[data-tab=videos]')?.getAttribute('aria-pressed') === 'true'",
                    timeout=2500,
                )
                if page.locator('#adminCategoryBar button[data-tab="videos"]').get_attribute("aria-pressed") != "true":
                    fail("admin/desktop: mobile category button did not expose its selected state after switching to Videos")

        if name == "upload-studio":
            page.locator("#studioContent").evaluate("(el) => { el.hidden = false; }")
            studio_tabs = page.evaluate(
                """() => [...document.querySelectorAll(".page-tabs [role=tab]")].map(el => ({
                  tab: el.dataset.tab, selected: el.getAttribute("aria-selected"), tabindex: el.getAttribute("tabindex"),
                  controls: el.getAttribute("aria-controls"), exists: !!document.getElementById(el.getAttribute("aria-controls") || "")
                }))"""
            )
            for item in studio_tabs:
                if item["selected"] not in ("true", "false") or item["tabindex"] not in ("0", "-1") or not item["controls"] or not item["exists"]:
                    fail(f"upload-studio/{viewport_name}: Studio navigation lacks selected state, roving tabindex or panel relationship ({item})")
            if not any(item["tab"] == "create" and item["selected"] == "true" and item["tabindex"] == "0" for item in studio_tabs):
                fail(f"upload-studio/{viewport_name}: Create Post is not exposed as the initially selected Studio tab")
            if page.locator(".page-tabs").get_attribute("aria-orientation") != "horizontal":
                fail(f"upload-studio/{viewport_name}: Studio tablist does not declare its horizontal orientation")
            page.locator("#studioTabCreate").focus()
            page.keyboard.press("ArrowRight")
            if page.evaluate("() => document.activeElement?.id") != "studioTabDrafts" or page.locator("#studioTabDrafts").get_attribute("aria-selected") != "true" or not page.locator("#view-drafts").is_visible():
                fail(f"upload-studio/{viewport_name}: ArrowRight did not select and reveal the Drafts panel")
            page.keyboard.press("End")
            if page.evaluate("() => document.activeElement?.id") != "studioTabMedia" or page.locator("#studioTabMedia").get_attribute("aria-selected") != "true":
                fail(f"upload-studio/{viewport_name}: End did not move to the last Studio tab")
            page.keyboard.press("Home")
            if page.evaluate("() => document.activeElement?.id") != "studioTabCreate" or page.locator("#studioTabCreate").get_attribute("aria-selected") != "true":
                fail(f"upload-studio/{viewport_name}: Home did not return to Create Post")

        if name == "homepage":
            category_state = page.evaluate(
                """() => {
                  const first = document.querySelector("#categoryTabs button[data-category]");
                  return first ? {pressed:first.getAttribute("aria-pressed"), active:first.classList.contains("active")} : null;
                }"""
            )
            if category_state and (category_state["pressed"] not in ("true", "false") or category_state["pressed"] != ("true" if category_state["active"] else "false")):
                fail(f"homepage/{viewport_name}: category filter selected state is not exposed to assistive technology ({category_state})")

        for system, asset in SYSTEM_STYLES.items():
            link_count = page.locator(f'link[rel="stylesheet"][href*="{asset}"]').count()
            if link_count != 1:
                fail(f"{name}/{viewport_name}: expected one {system} stylesheet link, found {link_count}")
        touch_link_count = page.locator('link[rel="stylesheet"][href*="/assets/sizing/touch-targets.css"]').count()
        if touch_link_count != 1:
            fail(f"{name}/{viewport_name}: expected one DUSS touch-target stylesheet link, found {touch_link_count}")

        if name != "profile":
            link_count = page.locator('link[rel="stylesheet"][href*="/assets/motion/motion.css"]').count()
            if link_count != 1:
                fail(f"{name}/{viewport_name}: expected one DUME stylesheet link, found {link_count}")

        metrics = page.evaluate(
            """() => {
              const root = getComputedStyle(document.documentElement);
              const body = getComputedStyle(document.body);
              const pick = (name) => body.getPropertyValue(name).trim() || root.getPropertyValue(name).trim();
              const header = document.querySelector("header");
              const headerRect = header ? header.getBoundingClientRect() : null;
              const controls = [...document.querySelectorAll(
                'button, input, select, textarea, [role="button"], a[href]'
              )].filter((el) => {
                const style = getComputedStyle(el);
                return !el.closest("[hidden]") && style.display !== "none"
                  && style.visibility !== "hidden" && el.getBoundingClientRect().width > 0
                  && el.getBoundingClientRect().height > 0;
              });
              const undersized = controls.filter((el) => {
                /* Disabled controls are not operable hit targets; still include them in zero-geometry checks. */
                if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
                const rect = el.getBoundingClientRect();
                return rect.width < 44 || rect.height < 44;
              });
              return {
                title: document.title,
                bodyTextLength: (document.body.innerText || "").trim().length,
                viewportWidth: innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                bodyWidth: document.body.scrollWidth,
                headerHeight: headerRect ? headerRect.height : 0,
                headerZIndex: header ? getComputedStyle(header).zIndex : "",
                tokens: {
                  duss: pick("--duss-header-height-desktop"),
                  dups: pick("--dups-layer-page-header"),
                  dupsHomeHeaderMobile: pick("--dups-layer-home-header-mobile"),
                  dupsLiveHeader: pick("--dups-layer-live-header"),
                  dupsSidebarMobile: pick("--dups-layer-sidebar-mobile"),
                  dupsSidebarBackdrop: pick("--dups-layer-sidebar-backdrop"),
                  dupsHomeSidebarMobile: pick("--dups-layer-home-sidebar-mobile"),
                  dupsHomeSidebarBackdrop: pick("--dups-layer-home-sidebar-backdrop"),
                  ducsBg: pick("--ducs-bg-canvas"),
                  ducsText: pick("--ducs-text-primary"),
                  ducsSecondary: pick("--ducs-text-secondary"),
                  ducsAction: pick("--ducs-action-primary"),
                  ducsBorder: pick("--ducs-border-default")
                },
                undersizedCount: undersized.length,
                undersizedExamples: undersized.slice(0, 4).map((el) => ({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || "",
                  className: typeof el.className === "string" ? el.className.slice(0, 60) : "",
                  width: Math.round(el.getBoundingClientRect().width),
                  height: Math.round(el.getBoundingClientRect().height)
                })),
                zeroSizeControls: [...document.querySelectorAll(
                  'button, input, select, textarea, [role="button"], a[href]'
                )].filter((el) => {
                  const style = getComputedStyle(el);
                  const visible = typeof el.checkVisibility === "function"
                    ? el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})
                    : !el.closest("[hidden]") && style.display !== "none" && style.visibility !== "hidden";
                  if (!visible) return false;
                  const rect = el.getBoundingClientRect();
                  return rect.width <= 0 || rect.height <= 0;
                }).length
,                stackingContextAncestors: [...document.querySelectorAll("body *")].flatMap((el) => {
                  const style = getComputedStyle(el);
                  if (!["fixed", "sticky"].includes(style.position)) return [];
                  const visible = typeof el.checkVisibility === "function"
                    ? el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})
                    : !el.closest("[hidden]") && style.display !== "none" && style.visibility !== "hidden";
                  if (!visible) return [];
                  const contexts = [];
                  let ancestor = el.parentElement;
                  while (ancestor && ancestor !== document.documentElement) {
                    const cs = getComputedStyle(ancestor);
                    const reasons = [];
                    const willChange = cs.willChange.split(/,\s*/);
                    const contain = cs.contain.split(/\s+/);
                    if (["absolute", "relative"].includes(cs.position) && cs.zIndex !== "auto") reasons.push("positioned-z-index");
                    if (["fixed", "sticky"].includes(cs.position)) reasons.push("fixed-or-sticky");
                    if (Number(cs.opacity) < 1) reasons.push("opacity");
                    if (cs.mixBlendMode !== "normal") reasons.push("mix-blend-mode");
                    if (cs.isolation === "isolate") reasons.push("isolation");
                    if (cs.transform !== "none" || cs.translate !== "none" || cs.rotate !== "none" || cs.scale !== "none") reasons.push("transform");
                    if (cs.filter !== "none") reasons.push("filter");
                    if (cs.backdropFilter !== "none") reasons.push("backdrop-filter");
                    if (cs.perspective !== "none") reasons.push("perspective");
                    if (contain.some(v => ["layout", "paint", "strict", "content"].includes(v))) reasons.push("contain");
                    if (cs.containerType && cs.containerType !== "normal") reasons.push("container-type");
                    if (cs.clipPath !== "none") reasons.push("clip-path");
                    if (cs.maskImage && cs.maskImage !== "none") reasons.push("mask");
                    if (willChange.some(v => ["opacity", "transform", "translate", "rotate", "scale", "filter", "backdrop-filter", "perspective", "mix-blend-mode", "clip-path", "mask", "contain", "container-type", "z-index"].includes(v))) reasons.push("will-change");
                    const parentDisplay = getComputedStyle(ancestor.parentElement || document.documentElement).display;
                    if (cs.zIndex !== "auto" && ["flex", "inline-flex", "grid", "inline-grid"].includes(parentDisplay)) reasons.push("flex-grid-item-z-index");
                    if (reasons.length) contexts.push({
                      selector: ancestor.id ? "#" + ancestor.id : ancestor.tagName.toLowerCase() + (typeof ancestor.className === "string" && ancestor.className.trim() ? "." + ancestor.className.trim().split(/\s+/).slice(0, 2).join(".") : ""),
                      reasons
                    });
                    ancestor = ancestor.parentElement;
                  }
                  return contexts.length ? [{
                    element: el.id ? "#" + el.id : el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""),
                    position: style.position,
                    contexts
                  }] : [];
                }),
                fixedAncestorIssues: [...document.querySelectorAll("body *")].flatMap((el) => {
                  const style = getComputedStyle(el);
                  if (!["fixed", "sticky"].includes(style.position)) return [];
                  const visible = typeof el.checkVisibility === "function"
                    ? el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})
                    : !el.closest("[hidden]") && style.display !== "none" && style.visibility !== "hidden";
                  if (!visible) return [];
                  const offenders = [];
                  let ancestor = el.parentElement;
                  while (ancestor && ancestor !== document.documentElement) {
                    const parentStyle = getComputedStyle(ancestor);
                    const contain = parentStyle.contain.split(/\\s+/);
                    const willChange = parentStyle.willChange.split(/,\\s*/);
                    if (parentStyle.transform !== "none" || parentStyle.perspective !== "none"
                      || parentStyle.filter !== "none" || parentStyle.backdropFilter !== "none"
                      || contain.some(value => ["paint", "layout", "strict", "content"].includes(value))
                      || willChange.some(value => ["transform", "perspective", "filter"].includes(value))) {
                      offenders.push({
                        tag: ancestor.tagName.toLowerCase(),
                        id: ancestor.id || "",
                        className: typeof ancestor.className === "string" ? ancestor.className.slice(0, 60) : ""
                      });
                    }
                    ancestor = ancestor.parentElement;
                  }
                  return offenders.length ? [{
                    tag: el.tagName.toLowerCase(),
                    id: el.id || "",
                    className: typeof el.className === "string" ? el.className.slice(0, 60) : "",
                    position: style.position,
                    ancestors: offenders
                  }] : [];
                }).slice(0, 8)
              };
            }"""
        )

        if metrics["bodyTextLength"] == 0:
            fail(f"{name}/{viewport_name}: body contains no visible text")
        if metrics["fixedAncestorIssues"]:
            fail(
                f"{name}/{viewport_name}: visible fixed/sticky elements have transformed, "
                f"filtered, contained, or will-change ancestors "
                f"({metrics['fixedAncestorIssues']})"
            )
        if name == "live-users" and width <= 760:
            live_header = page.evaluate(
                """() => {
                  const element = document.querySelector(".live-topbar");
                  const root = getComputedStyle(document.documentElement);
                  if (!element) return {missing: true};
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return {
                    position: style.position,
                    left: rect.left,
                    right: innerWidth - rect.right,
                    expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0"))
                  };
                }"""
            )
            if live_header.get("missing"):
                fail(f"{name}/{viewport_name}: Live Users compact topbar is missing")
            elif live_header["position"] != "fixed" or any(abs(live_header[key] - live_header["expectedZero"]) > 1 for key in ("left", "right")):
                fail(f"{name}/{viewport_name}: Live Users compact topbar horizontal edges differ from DUPS zero-offset token ({live_header})")
        if name == "upload-studio":
            thumbnail_overlay = page.evaluate(
                """() => {
                  const fixture = document.createElement("div");
                  fixture.className = "preview-thumb";
                  fixture.style.position = "relative";
                  fixture.innerHTML = "<span></span>";
                  document.body.appendChild(fixture);
                  const overlay = getComputedStyle(fixture.querySelector("span"));
                  const root = getComputedStyle(document.documentElement);
                  const result = {
                    position: overlay.position,
                    edges: [overlay.top, overlay.right, overlay.bottom, overlay.left],
                    expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0"))
                  };
                  fixture.remove();
                  return result;
                }"""
            )
            if thumbnail_overlay["position"] != "absolute":
                fail(f"{name}/{viewport_name}: thumbnail overlay is not absolutely anchored ({thumbnail_overlay})")
            if any(abs(float(edge.replace("px", "")) - thumbnail_overlay["expectedZero"]) > 1 for edge in thumbnail_overlay["edges"]):
                fail(f"{name}/{viewport_name}: thumbnail overlay fill edges differ from DUPS zero-offset token ({thumbnail_overlay})")
        if name == "upload-studio" and width <= 760:
            upload_header = page.evaluate(
                """() => {
                  const element = document.querySelector(".studio-global-topbar");
                  const root = getComputedStyle(document.documentElement);
                  if (!element) return {missing: true};
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return {
                    position: style.position,
                    top: rect.top,
                    left: rect.left,
                    right: innerWidth - rect.right,
                    expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0")),
                    zIndex: parseFloat(style.zIndex),
                    expectedLayer: parseFloat(root.getPropertyValue("--dups-layer-home-header-mobile"))
                  };
                }"""
            )
            if upload_header.get("missing"):
                fail(f"{name}/{viewport_name}: global Upload Studio header is missing")
            else:
                try:
                    if upload_header["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: mobile Upload Studio header is not fixed ({upload_header})")
                    if any(abs(upload_header[key] - upload_header["expectedZero"]) > 1 for key in ("top", "left", "right")):
                        fail(f"{name}/{viewport_name}: mobile Upload Studio header edge anchors differ from DUPS zero-inset token ({upload_header})")
                    if upload_header["zIndex"] != upload_header["expectedLayer"]:
                        fail(f"{name}/{viewport_name}: mobile Upload Studio header layer differs from DUPS token ({upload_header})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: mobile Upload Studio header DUPS geometry could not be resolved ({upload_header})")
        for entry in metrics["stackingContextAncestors"]:
            for context in entry["contexts"]:
                for reason in context["reasons"]:
                    key = f"{context['selector']}::{reason}"
                    record = STACKING_CONTEXT_AUDIT.setdefault(key, {"count": 0, "samples": []})
                    record["count"] += 1
                    sample = f"{name}/{viewport_name}:{entry['element']}({entry['position']})"
                    if sample not in record["samples"] and len(record["samples"]) < 3:
                        record["samples"].append(sample)
        if metrics["headerHeight"] <= 0:
            fail(f"{name}/{viewport_name}: visible header geometry could not be measured")
        if name in ("homepage", "movies"):
            shell_edges = page.evaluate(
                """() => {
                  const root = getComputedStyle(document.documentElement);
                  const zero = parseFloat(root.getPropertyValue("--dups-offset-0"));
                  const header = document.querySelector(".topbar");
                  const category = document.querySelector(".category-bar");
                  const measure = (element) => {
                    if (!element) return {missing: true};
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return {
                      position: style.position,
                      top: rect.top,
                      left: rect.left,
                      right: innerWidth - rect.right
                    };
                  };
                  return {
                    zero,
                    header: measure(header),
                    category: measure(category),
                    headerBottom: header ? header.getBoundingClientRect().bottom : null
                  };
                }"""
            )
            for label in ("header", "category"):
                geometry = shell_edges[label]
                if geometry.get("missing"):
                    fail(f"{name}/{viewport_name}: shared {label} element is missing")
                    continue
                try:
                    if geometry["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: shared {label} is no longer fixed-positioned ({geometry})")
                    expected_top = shell_edges["zero"] if label == "header" else shell_edges["headerBottom"]
                    if abs(geometry["top"] - expected_top) > 1 or abs(geometry["left"] - shell_edges["zero"]) > 1 or abs(geometry["right"] - shell_edges["zero"]) > 1:
                        fail(f"{name}/{viewport_name}: shared {label} viewport-edge geometry differs from the DUPS anchors ({geometry}, expectedTop={expected_top}, zero={shell_edges['zero']})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: shared {label} DUPS edge geometry could not be resolved ({geometry})")
        if name in ("homepage", "movies"):
            drawer_edges = page.evaluate(
                """() => {
                  const drawer = document.querySelector(".profile-drawer");
                  const backdrop = document.querySelector(".profile-drawer-backdrop");
                  const sidebar = document.querySelector(".yt-sidebar");
                  const root = getComputedStyle(document.documentElement);
                  const zero = parseFloat(root.getPropertyValue("--dups-offset-0"));
                  if (!drawer || !backdrop || !sidebar) return {missing: true};
                  const sidebarStyle = getComputedStyle(sidebar);
                  const sidebarResult = {
                    position: sidebarStyle.position,
                    top: parseFloat(sidebarStyle.top),
                    left: parseFloat(sidebarStyle.left),
                    bottom: parseFloat(sidebarStyle.bottom)
                  };
                  const drawerStyle = getComputedStyle(drawer);
                  const drawerResult = {
                    position: drawerStyle.position,
                    top: parseFloat(drawerStyle.top),
                    right: parseFloat(drawerStyle.right),
                    bottom: parseFloat(drawerStyle.bottom)
                  };
                  const wasHidden = backdrop.hidden;
                  backdrop.hidden = false;
                  const backdropStyle = getComputedStyle(backdrop);
                  const backdropResult = {
                    position: backdropStyle.position,
                    top: parseFloat(backdropStyle.top),
                    right: parseFloat(backdropStyle.right),
                    bottom: parseFloat(backdropStyle.bottom),
                    left: parseFloat(backdropStyle.left)
                  };
                  backdrop.hidden = wasHidden;
                  return {zero, drawer: drawerResult, backdrop: backdropResult, sidebar: sidebarResult};
                }"""
            )
            if drawer_edges.get("missing"):
                fail(f"{name}/{viewport_name}: Profile drawer, backdrop, or sidebar is missing")
            else:
                try:
                    drawer = drawer_edges["drawer"]
                    sidebar = drawer_edges["sidebar"]
                    if drawer["position"] != "fixed" or any(abs(drawer[key] - drawer_edges["zero"]) > 1 for key in ("top", "right", "bottom")):
                        fail(f"{name}/{viewport_name}: Profile drawer fixed viewport-edge anchors differ from the DUPS zero-offset token ({drawer_edges})")
                    if sidebar["position"] != "fixed" or abs(sidebar["left"] - drawer_edges["zero"]) > 1 or abs(sidebar["bottom"] - drawer_edges["zero"]) > 1:
                        fail(f"{name}/{viewport_name}: Homepage sidebar fixed edge anchors differ from the DUPS zero-offset token ({drawer_edges})")
                    if width <= 760:
                        if abs(sidebar["top"] - drawer_edges["zero"]) > 1:
                            fail(f"{name}/{viewport_name}: compact Homepage sidebar top anchor differs from the DUPS zero-offset token ({drawer_edges})")
                        backdrop = drawer_edges["backdrop"]
                        if backdrop["position"] != "fixed" or any(abs(backdrop[key] - drawer_edges["zero"]) > 1 for key in ("top", "right", "bottom", "left")):
                            fail(f"{name}/{viewport_name}: compact Profile drawer backdrop does not fill the viewport using the DUPS zero-offset token ({drawer_edges})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Profile drawer/backdrop DUPS geometry could not be resolved ({drawer_edges})")

        if name != "profile":
            expected_layer = (
                metrics["tokens"]["dupsLiveHeader"]
                if name == "live-users"
                else metrics["tokens"]["dupsHomeHeaderMobile"]
                if name in ("homepage", "movies", "upload-studio") and width <= 760
                else metrics["tokens"]["dups"]
            )
            try:
                actual_layer = float(metrics["headerZIndex"])
                expected_layer_value = float(expected_layer)
                if actual_layer != expected_layer_value:
                    fail(
                        f"{name}/{viewport_name}: computed header z-index {actual_layer:g} "
                        f"does not match DUPS layer token {expected_layer_value:g}"
                    )
            except (TypeError, ValueError):
                fail(
                    f"{name}/{viewport_name}: DUPS header layer could not be resolved "
                    f"(computed={metrics['headerZIndex']!r}, token={expected_layer!r})"
                )
        if name in ("homepage", "movies") and width <= 900:
            builder_inspector = page.evaluate(
                """() => {
                  const shell = document.querySelector("#siteBuilder");
                  const element = document.querySelector(".sb-inspector");
                  const root = getComputedStyle(document.documentElement);
                  if (!shell || !element) return {missing: true};
                  shell.hidden = false;
                  const style = getComputedStyle(element);
                  const shellRect = shell.getBoundingClientRect();
                  const rect = element.getBoundingClientRect();
                  return {
                    shellPosition: getComputedStyle(shell).position,
                    shellWidth: shellRect.width,
                    shellHeight: shellRect.height,
                    position: style.position,
                    zIndex: style.zIndex,
                    token: root.getPropertyValue("--dups-layer-builder-inspector").trim(),
                    top: rect.top - shellRect.top,
                    right: shellRect.right - rect.right,
                    bottom: shellRect.bottom - rect.bottom,
                    expectedTop: parseFloat(style.getPropertyValue("--dups-anchor-builder-inspector-top")),
                    expectedRight: parseFloat(style.getPropertyValue("--dups-anchor-builder-inspector-right")),
                    expectedBottom: parseFloat(style.getPropertyValue("--dups-anchor-builder-inspector-bottom"))
                  };
                }"""
            )
            if builder_inspector.get("missing"):
                fail(f"{name}/{viewport_name}: Builder inspector or shell is missing")
            else:
                try:
                    if builder_inspector["shellPosition"] != "fixed" or builder_inspector["shellWidth"] <= 0 or builder_inspector["shellHeight"] <= 0:
                        fail(f"{name}/{viewport_name}: Website Builder shell is not a rendered fixed containing block ({builder_inspector})")
                    if builder_inspector["position"] != "absolute":
                        fail(f"{name}/{viewport_name}: responsive Builder inspector is not absolutely positioned ({builder_inspector})")
                    if float(builder_inspector["zIndex"]) != float(builder_inspector["token"]):
                        fail(f"{name}/{viewport_name}: Builder inspector z-index does not match its DUPS token ({builder_inspector})")
                    if abs(builder_inspector["top"] - builder_inspector["expectedTop"]) > 1 or abs(builder_inspector["right"] - builder_inspector["expectedRight"]) > 1 or abs(builder_inspector["bottom"] - builder_inspector["expectedBottom"]) > 1:
                        fail(f"{name}/{viewport_name}: Builder inspector offsets do not match its fixed shell containing block ({builder_inspector})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Builder inspector DUPS layer/geometry could not be resolved ({builder_inspector})")

        if name == "live-users":
            live_notice_anchor = page.evaluate(
                """() => {
                  const notice = document.querySelector("#liveNotice");
                  const root = getComputedStyle(document.documentElement);
                  if (!notice) return {missing: true};
                  const style = getComputedStyle(notice);
                  return {
                    position: style.position,
                    left: parseFloat(style.left),
                    bottom: parseFloat(style.bottom),
                    transform: style.transform,
                    zIndex: parseFloat(style.zIndex),
                    expectedCenter: parseFloat(root.getPropertyValue("--dups-anchor-live-notice-center")),
                    expectedBottom: parseFloat(root.getPropertyValue("--dups-anchor-live-notice-bottom")),
                    expectedCompactLeft: parseFloat(root.getPropertyValue("--dups-anchor-live-notice-left-compact")),
                    expectedCompactRight: parseFloat(root.getPropertyValue("--dups-anchor-live-notice-right-compact")),
                    right: style.right === "auto" ? null : parseFloat(style.right),
                    expectedZ: parseFloat(root.getPropertyValue("--dups-layer-live-notice"))
                  };
                }"""
            )
            if live_notice_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: Live Users notice element is missing")
            else:
                try:
                    if live_notice_anchor["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: Live Users notice is not fixed-positioned ({live_notice_anchor})")
                    if width <= 760:
                        if abs(live_notice_anchor["left"] - live_notice_anchor["expectedCompactLeft"]) > 1 or abs(live_notice_anchor["right"] - live_notice_anchor["expectedCompactRight"]) > 1:
                            fail(f"{name}/{viewport_name}: compact Live Users notice side insets differ from DUPS tokens ({live_notice_anchor})")
                    elif abs(live_notice_anchor["left"] - width * live_notice_anchor["expectedCenter"] / 100) > 1:
                        fail(f"{name}/{viewport_name}: desktop Live Users notice center anchor differs from its DUPS token ({live_notice_anchor})")
                    if abs(live_notice_anchor["bottom"] - live_notice_anchor["expectedBottom"]) > 1:
                        fail(f"{name}/{viewport_name}: Live Users notice bottom clearance differs from its DUPS token ({live_notice_anchor})")
                    if float(live_notice_anchor["zIndex"]) != live_notice_anchor["expectedZ"]:
                        fail(f"{name}/{viewport_name}: Live Users notice layer differs from its DUPS token ({live_notice_anchor})")
                    if not live_notice_anchor["transform"].startswith("matrix(1, 0, 0, 1,"):
                        fail(f"{name}/{viewport_name}: Live Users notice must retain its horizontal centering transform ({live_notice_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Live Users notice anchor could not be resolved ({live_notice_anchor})")

        if name == "live-users":
            presence_dot_anchor = page.evaluate(
                """() => {
                  const fixture = document.createElement("span");
                  fixture.className = "live-avatar";
                  fixture.style.position = "relative";
                  fixture.innerHTML = '<img alt=""><i class="live-presence-dot"></i>';
                  document.body.appendChild(fixture);
                  const drawerFixture = document.createElement("span");
                  drawerFixture.className = "live-drawer-avatar";
                  drawerFixture.style.position = "relative";
                  drawerFixture.innerHTML = '<img alt="">';
                  document.body.appendChild(drawerFixture);
                  const dot = getComputedStyle(fixture.querySelector(".live-presence-dot"));
                  const avatarImage = getComputedStyle(fixture.querySelector("img"));
                  const drawerImage = getComputedStyle(drawerFixture.querySelector("img"));
                  const root = getComputedStyle(document.documentElement);
                  return {
                    position: dot.position,
                    right: parseFloat(dot.right),
                    bottom: parseFloat(dot.bottom),
                    expected: parseFloat(root.getPropertyValue("--dups-anchor-live-presence-edge")),
                    expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0")),
                    avatarImagePosition: avatarImage.position,
                    avatarImageEdges: [avatarImage.top, avatarImage.right, avatarImage.bottom, avatarImage.left],
                    drawerImagePosition: drawerImage.position,
                    drawerImageEdges: [drawerImage.top, drawerImage.right, drawerImage.bottom, drawerImage.left]
                  };
                }"""
            )
            try:
                if presence_dot_anchor["position"] != "absolute":
                    fail(f"{name}/{viewport_name}: Live Users presence dot is not absolutely anchored ({presence_dot_anchor})")
                if abs(presence_dot_anchor["right"] - presence_dot_anchor["expected"]) > 1 or abs(presence_dot_anchor["bottom"] - presence_dot_anchor["expected"]) > 1:
                    fail(f"{name}/{viewport_name}: Live Users presence dot offsets differ from DUPS token ({presence_dot_anchor})")
            except (TypeError, ValueError, KeyError):
                fail(f"{name}/{viewport_name}: Live Users presence dot anchor could not be resolved ({presence_dot_anchor})")

        if name in ("homepage", "movies"):
            header_status_anchor = page.evaluate(
                """() => {
                  const status = document.querySelector("#headerLoginStatus");
                  const header = document.querySelector(".topbar");
                  const root = getComputedStyle(document.documentElement);
                  if (!status || !header) return {missing: true};
                  const previousText = status.textContent;
                  status.textContent = "DUPS geometry fixture";
                  const style = getComputedStyle(status);
                  const compact = innerWidth <= 760;
                  const rootSize = parseFloat(root.fontSize) || 16;
                  const gapName = compact
                    ? "--dups-anchor-gap-status"
                    : "--dups-anchor-header-login-status-gap";
                  const gapValue = root.getPropertyValue(gapName).trim();
                  const gap = gapValue.endsWith("rem")
                    ? parseFloat(gapValue) * rootSize : parseFloat(gapValue);
                  const rightValue = compact ? root.getPropertyValue("--dups-offset-2").trim() : root.getPropertyValue("--dups-offset-0").trim();
                  const right = rightValue.endsWith("rem")
                    ? parseFloat(rightValue) * rootSize : parseFloat(rightValue);
                  const statusRect = status.getBoundingClientRect();
                  const anchor = status.offsetParent || header;
                  const anchorRect = anchor.getBoundingClientRect();
                  const result = {
                    position: style.position,
                    gap: statusRect.top - anchorRect.bottom,
                    right: parseFloat(style.right),
                    zIndex: style.zIndex,
                    anchorClass: anchor.className,
                    expectedGap: gap,
                    expectedRight: right,
                    expectedLayer: parseFloat(root.getPropertyValue("--dups-layer-header-status"))
                  };
                  status.textContent = previousText;
                  return result;
                }"""
            )
            if header_status_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: header login status anchor/header is missing")
            else:
                try:
                    if header_status_anchor["position"] != "absolute":
                        fail(f"{name}/{viewport_name}: header login status is not absolutely anchored ({header_status_anchor})")
                    if abs(header_status_anchor["gap"] - header_status_anchor["expectedGap"]) > 1:
                        fail(f"{name}/{viewport_name}: header login status anchor gap differs from its responsive DUPS token ({header_status_anchor})")
                    if abs(header_status_anchor["right"] - header_status_anchor["expectedRight"]) > 1:
                        fail(f"{name}/{viewport_name}: header login status right offset differs from its responsive DUPS value ({header_status_anchor})")
                    if float(header_status_anchor["zIndex"]) != header_status_anchor["expectedLayer"]:
                        fail(f"{name}/{viewport_name}: header login status layer differs from its DUPS token ({header_status_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: header login status anchor/layer could not be resolved ({header_status_anchor})")

        if name in ("homepage", "movies"):
            hero_anchor = page.evaluate(
                """() => {
                  const hero = document.querySelector(".hero-visual");
                  const corner = document.querySelector(".hero-corner");
                  if (!hero || !corner) return {missing: true};
                  const heroStyle = getComputedStyle(hero);
                  const cornerStyle = getComputedStyle(corner);
                  const overlayStyle = getComputedStyle(hero, "::before");
                  const root = getComputedStyle(document.documentElement);
                  return {
                    heroPosition: heroStyle.position,
                    cornerPosition: cornerStyle.position,
                    cornerRight: parseFloat(cornerStyle.right),
                    cornerBottom: parseFloat(cornerStyle.bottom),
                    expectedCorner: parseFloat(root.getPropertyValue("--dups-anchor-hero-corner-edge")),
                    overlayPosition: overlayStyle.position,
                    overlayInsets: [overlayStyle.top, overlayStyle.right, overlayStyle.bottom, overlayStyle.left],
                    expectedInset: parseFloat(root.getPropertyValue("--dups-anchor-hero-overlay-inset"))
                  };
                }"""
            )
            if hero_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: Homepage hero or corner decoration is missing")
            else:
                try:
                    if hero_anchor["heroPosition"] != "relative" or hero_anchor["cornerPosition"] != "absolute" or hero_anchor["overlayPosition"] != "absolute":
                        fail(f"{name}/{viewport_name}: Homepage hero anchor positioning context changed ({hero_anchor})")
                    if abs(hero_anchor["cornerRight"] - hero_anchor["expectedCorner"]) > 1 or abs(hero_anchor["cornerBottom"] - hero_anchor["expectedCorner"]) > 1:
                        fail(f"{name}/{viewport_name}: Homepage hero corner offsets differ from DUPS token ({hero_anchor})")
                    if any(abs(float(value.replace("px", "")) - hero_anchor["expectedInset"]) > 1 for value in hero_anchor["overlayInsets"]):
                        fail(f"{name}/{viewport_name}: Homepage hero overlay no longer fills its containing block ({hero_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Homepage hero anchor geometry could not be resolved ({hero_anchor})")

            builder_live_overlay = page.evaluate(
                """() => {
                  const wrap = document.createElement("div");
                  wrap.className = "sb-live-preview-wrap";
                  wrap.style.width = "200px";
                  wrap.style.height = "120px";
                  const overlay = document.createElement("div");
                  overlay.className = "sb-live-edit-overlay";
                  wrap.appendChild(overlay);
                  document.body.appendChild(wrap);
                  const wrapStyle = getComputedStyle(wrap);
                  const style = getComputedStyle(overlay);
                  const root = getComputedStyle(document.documentElement);
                  return {
                    containingBlockPosition: wrapStyle.position,
                    isolation: wrapStyle.isolation,
                    position: style.position,
                    top: style.top,
                    right: style.right,
                    bottom: style.bottom,
                    left: style.left,
                    zIndex: parseFloat(style.zIndex),
                    expectedZ: parseFloat(root.getPropertyValue("--dups-layer-builder-live-overlay"))
                  };
                }"""
            )
            try:
                if builder_live_overlay["containingBlockPosition"] != "relative" or builder_live_overlay["isolation"] != "isolate":
                    fail(f"{name}/{viewport_name}: Builder live-edit overlay containing block/isolation changed ({builder_live_overlay})")
                if builder_live_overlay["position"] != "absolute" or any(abs(float(builder_live_overlay[edge].replace("px", ""))) > 1 for edge in ("top", "right", "bottom", "left")):
                    fail(f"{name}/{viewport_name}: Builder live-edit overlay no longer fills its preview wrapper ({builder_live_overlay})")
                if builder_live_overlay["zIndex"] != builder_live_overlay["expectedZ"]:
                    fail(f"{name}/{viewport_name}: Builder live-edit overlay layer differs from its DUPS token ({builder_live_overlay})")
            except (TypeError, ValueError, KeyError):
                fail(f"{name}/{viewport_name}: Builder live-edit overlay geometry/layer could not be resolved ({builder_live_overlay})")

            register_close_anchor = page.evaluate(
                """() => {
                  const dialog = document.querySelector("#registerDialog");
                  const close = document.querySelector("#registerClose");
                  if (!dialog || !close) return {missing: true};
                  if (!dialog.open) dialog.showModal();
                  const style = getComputedStyle(close);
                  const root = getComputedStyle(document.documentElement);
                  return {
                    position: style.position,
                    top: parseFloat(style.top),
                    right: parseFloat(style.right),
                    expectedTop: parseFloat(root.getPropertyValue("--dups-anchor-register-close-top")),
                    expectedRight: parseFloat(root.getPropertyValue("--dups-anchor-register-close-right"))
                  };
                }"""
            )
            if register_close_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: registration dialog close control is missing")
            else:
                try:
                    if register_close_anchor["position"] != "absolute":
                        fail(f"{name}/{viewport_name}: registration close control is not absolutely anchored ({register_close_anchor})")
                    if abs(register_close_anchor["top"] - register_close_anchor["expectedTop"]) > 1 or abs(register_close_anchor["right"] - register_close_anchor["expectedRight"]) > 1:
                        fail(f"{name}/{viewport_name}: registration close-control offsets differ from DUPS tokens ({register_close_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: registration close-control anchor could not be resolved ({register_close_anchor})")

            visual_editor_anchor = page.evaluate(
                """() => {
                  const toggle = document.querySelector(".visual-editor-toggle");
                  const panel = document.querySelector(".visual-editor-panel");
                  const rootStyle = getComputedStyle(document.documentElement);
                  const rootSize = parseFloat(rootStyle.fontSize) || 16;
                  const px = (name) => {
                    const value = rootStyle.getPropertyValue(name).trim();
                    return value.endsWith("rem") ? parseFloat(value) * rootSize : parseFloat(value);
                  };
                  if (!toggle || !panel) return {missing: true};
                  toggle.hidden = false;
                  panel.hidden = false;
                  const button = getComputedStyle(toggle);
                  const drawer = getComputedStyle(panel);
                  return {
                    togglePosition: button.position,
                    toggleRight: parseFloat(button.right),
                    toggleBottom: parseFloat(button.bottom),
                    toggleZ: button.zIndex,
                    panelPosition: drawer.position,
                    panelTop: parseFloat(drawer.top),
                    panelLeft: parseFloat(drawer.left),
                    panelZ: drawer.zIndex,
                    expectedEdge: px(innerWidth <= 600
                      ? "--dups-anchor-visual-editor-edge-compact"
                      : "--dups-anchor-visual-editor-edge"),
                    expectedPanelTop: px("--dups-anchor-visual-editor-panel-top"),
                    expectedPanelLeft: px("--dups-anchor-visual-editor-panel-left"),
                    expectedToggleZ: parseFloat(rootStyle.getPropertyValue("--dups-layer-visual-editor")),
                    expectedPanelZ: parseFloat(rootStyle.getPropertyValue("--dups-layer-visual-editor-panel-legacy"))
                  };
                }"""
            )
            if visual_editor_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: visual editor toggle or panel is missing")
            else:
                try:
                    if visual_editor_anchor["togglePosition"] != "fixed" or visual_editor_anchor["panelPosition"] != "fixed":
                        fail(f"{name}/{viewport_name}: visual editor controls are not fixed-positioned ({visual_editor_anchor})")
                    if abs(visual_editor_anchor["toggleRight"] - visual_editor_anchor["expectedEdge"]) > 1 or abs(visual_editor_anchor["toggleBottom"] - visual_editor_anchor["expectedEdge"]) > 1:
                        fail(f"{name}/{viewport_name}: visual editor toggle edge offsets differ from DUPS tokens ({visual_editor_anchor})")
                    if abs(visual_editor_anchor["panelTop"] - visual_editor_anchor["expectedPanelTop"]) > 1 or abs(visual_editor_anchor["panelLeft"] - visual_editor_anchor["expectedPanelLeft"]) > 1:
                        fail(f"{name}/{viewport_name}: visual editor panel anchor offsets differ from DUPS tokens ({visual_editor_anchor})")
                    if float(visual_editor_anchor["toggleZ"]) != visual_editor_anchor["expectedToggleZ"] or float(visual_editor_anchor["panelZ"]) != visual_editor_anchor["expectedPanelZ"]:
                        fail(f"{name}/{viewport_name}: visual editor stacking layers differ from DUPS tokens ({visual_editor_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: visual editor DUPS geometry/layers could not be resolved ({visual_editor_anchor})")

        if name == "admin":
            admin_category_anchor = page.evaluate(
                """() => {
                  const bar = document.querySelector(".admin-category-bar");
                  if (!bar) return {missing: true};
                  const style = getComputedStyle(bar);
                  const value = style.getPropertyValue("--dups-anchor-category-bar-top").trim();
                  const token = value.endsWith("rem")
                    ? parseFloat(value) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
                    : parseFloat(value);
                  const root = getComputedStyle(document.documentElement);
                  return {position: style.position, top: parseFloat(style.top), token,
                    left: parseFloat(style.left), right: parseFloat(style.right),
                    expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0"))};
                }"""
            )
            if admin_category_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: Admin Category Bar is missing")
            else:
                try:
                    if admin_category_anchor["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: Admin Category Bar is not fixed-positioned ({admin_category_anchor})")
                    if abs(admin_category_anchor["top"] - float(admin_category_anchor["token"])) > 1:
                        fail(f"{name}/{viewport_name}: Admin Category Bar computed top does not match its DUPS token ({admin_category_anchor})")
                    if any(abs(admin_category_anchor[edge] - admin_category_anchor["expectedZero"]) > 1 for edge in ("left", "right")):
                        fail(f"{name}/{viewport_name}: Admin Category Bar horizontal edges differ from the DUPS zero-offset token ({admin_category_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Admin Category Bar anchor token could not be resolved ({admin_category_anchor})")

        if name in ("homepage", "movies"):
            category_anchor = page.evaluate(
                """() => {
                  const bar = document.querySelector(".category-bar");
                  const form = document.querySelector("#headerLoginForm");
                  const profile = document.querySelector("#profileMenuToggle");
                  if (!bar) return {missing: true};
                  const states = [{loginHidden: false, profileHidden: true},
                    {loginHidden: true, profileHidden: true},
                    {loginHidden: true, profileHidden: false}];
                  const original = {loginHidden: form?.hidden, profileHidden: profile?.hidden};
                  const results = [];
                  for (const state of (innerWidth <= 760 ? states : [states[0]])) {
                    if (form) form.hidden = state.loginHidden;
                    if (profile) profile.hidden = state.profileHidden;
                    const style = getComputedStyle(bar);
                    const tokenValue = style.getPropertyValue("--dups-anchor-category-bar-top").trim();
                    const tokenPixels = tokenValue.endsWith("rem")
                      ? parseFloat(tokenValue) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
                      : parseFloat(tokenValue);
                    results.push({
                      state,
                      position: style.position,
                      top: parseFloat(style.top),
                      token: tokenPixels,
                      left: parseFloat(style.left),
                      right: parseFloat(style.right),
                      expectedZero: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dups-offset-0"))
                    });
                  }
                  if (form) form.hidden = original.loginHidden;
                  if (profile) profile.hidden = original.profileHidden;
                  return results;
                }"""
            )
            if isinstance(category_anchor, dict) and category_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: Homepage Category Bar is missing")
            else:
                for state in category_anchor:
                    try:
                        if state["position"] != "fixed":
                            fail(f"{name}/{viewport_name}: Category Bar is not fixed-positioned ({state})")
                        if abs(state["top"] - float(state["token"])) > 1:
                            fail(f"{name}/{viewport_name}: Category Bar computed top does not match its DUPS state token ({state})")
                        if any(abs(state[edge] - state["expectedZero"]) > 1 for edge in ("left", "right")):
                            fail(f"{name}/{viewport_name}: Category Bar horizontal edges differ from the DUPS zero-offset token ({state})")
                    except (TypeError, ValueError, KeyError):
                        fail(f"{name}/{viewport_name}: Category Bar anchor token could not be resolved ({state})")

            drawer_clearance = page.evaluate(
                """() => {
                  const bar = document.querySelector(".category-bar");
                  if (!bar) return {missing: true};
                  const wasOpen = document.body.classList.contains("profile-drawer-open");
                  const previousTransition = bar.style.getPropertyValue("transition");
                  const previousPriority = bar.style.getPropertyPriority("transition");
                  bar.style.setProperty("transition", "none", "important");
                  document.body.classList.add("profile-drawer-open");
                  const style = getComputedStyle(bar);
                  const result = {
                    position: style.position,
                    right: parseFloat(style.right),
                    token: parseFloat(style.getPropertyValue("--dups-anchor-profile-drawer-clearance"))
                  };
                  if (!wasOpen) document.body.classList.remove("profile-drawer-open");
                  if (previousTransition) bar.style.setProperty("transition", previousTransition, previousPriority);
                  else bar.style.removeProperty("transition");
                  return result;
                }"""
            )
            if drawer_clearance.get("missing"):
                fail(f"{name}/{viewport_name}: Category Bar is missing for Profile drawer clearance check")
            else:
                try:
                    if drawer_clearance["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: Category Bar is not fixed during Profile drawer open ({drawer_clearance})")
                    if abs(drawer_clearance["right"] - drawer_clearance["token"]) > 1:
                        fail(f"{name}/{viewport_name}: Category Bar right clearance differs from its DUPS token ({drawer_clearance})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Profile drawer Category Bar clearance token could not be resolved ({drawer_clearance})")

            homepage_layers = page.evaluate(
                """() => {
                  const root = getComputedStyle(document.documentElement);
                  const contracts = [
                    ["site-builder", "#siteBuilder", "--dups-layer-site-builder"],
                    ["register-dialog", "#registerDialog", "--dups-layer-register-dialog"],
                    ["suspension-screen", "#accountSuspensionScreen", "--dups-layer-suspension-screen"],
                    ["suspension-grain", ".suspension-grain", null],
                    ["profile-bar-backdrop", "#profileBarBackdrop", "--dups-layer-profile-complete-backdrop"],
                    ["profile-complete-bar", "#profileCompleteBar", "--dups-layer-profile-complete-bar"]
                  ];
                  return contracts.map(([name, selector, token]) => {
                    const element = document.querySelector(selector);
                    if (!element) return {name, missing: true};
                    if (name === "profile-bar-backdrop" || name === "profile-complete-bar") element.hidden = false;
                    const style = getComputedStyle(element);
                    return {
                      name,
                      position: style.position,
                      zIndex: style.zIndex,
                      token: token ? root.getPropertyValue(token).trim() : null,
                      top: style.top,
                      right: style.right,
                      bottom: style.bottom,
                      left: style.left,
                      expectedZero: parseFloat(root.getPropertyValue("--dups-offset-0")),
                      anchorTopToken: style.getPropertyValue("--dups-anchor-profile-complete-top").trim(),
                      anchorCenterToken: style.getPropertyValue("--dups-anchor-profile-complete-center").trim(),
                      backdropInsets: name === "profile-bar-backdrop"
                        ? [style.top, style.right, style.bottom, style.left] : null
                    };
                  });
                }"""
            )
            for layer in homepage_layers:
                if layer.get("missing"):
                    fail(f"{name}/{viewport_name}: DUPS overlay element {layer['name']} is missing")
                    continue
                try:
                    if layer["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: {layer['name']} is not fixed-positioned ({layer})")
                    if layer["token"] is not None and float(layer["zIndex"]) != float(layer["token"]):
                        fail(f"{name}/{viewport_name}: {layer['name']} z-index does not match its DUPS token ({layer})")
                    if layer["name"] in ("site-builder", "register-dialog", "suspension-screen", "suspension-grain"):
                        if any(abs(float(layer[edge].replace("px", "")) - layer["expectedZero"]) > 1 for edge in ("top", "right", "bottom", "left")):
                            fail(f"{name}/{viewport_name}: {layer['name']} full-viewport edges differ from the DUPS zero-offset token ({layer})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: {layer['name']} DUPS layer could not be resolved ({layer})")
            try:
                layers_by_name = {layer["name"]: float(layer["zIndex"]) for layer in homepage_layers if not layer.get("missing") and layer["zIndex"] != "auto"}
                if layers_by_name.get("profile-complete-bar", 0) <= layers_by_name.get("profile-bar-backdrop", 0):
                    fail(f"{name}/{viewport_name}: profile completion bar must stack above its backdrop ({layers_by_name})")
                profile_bar = next(layer for layer in homepage_layers if layer["name"] == "profile-complete-bar")
                expected_top = float(profile_bar["anchorTopToken"].replace("px", ""))
                expected_center = float(profile_bar["anchorCenterToken"].replace("%", ""))
                if abs(float(profile_bar["top"].replace("px", "")) - expected_top) > 1:
                    fail(f"{name}/{viewport_name}: profile completion bar top offset differs from its DUPS token ({profile_bar})")
                if abs(float(profile_bar["left"].replace("px", "")) - (width * expected_center / 100)) > 1:
                    fail(f"{name}/{viewport_name}: profile completion bar center anchor differs from its DUPS token ({profile_bar})")
                backdrop = next(layer for layer in homepage_layers if layer["name"] == "profile-bar-backdrop")
                if any(abs(float(value.replace("px", ""))) > 1 for value in backdrop["backdropInsets"]):
                    fail(f"{name}/{viewport_name}: profile completion backdrop must cover the full viewport ({backdrop})")
            except (TypeError, ValueError, KeyError, StopIteration):
                fail(f"{name}/{viewport_name}: profile completion overlay geometry/stack could not be compared ({homepage_layers})")

        if name == "live-users":
            closing_effect_layers = page.evaluate(
                """() => {
                  const drawer = document.querySelector(".live-user-drawer");
                  const root = getComputedStyle(document.documentElement);
                  if (!drawer) return {missing: true};
                  drawer.classList.add("is-closing");
                  return {
                    before: getComputedStyle(drawer, "::before").zIndex,
                    after: getComputedStyle(drawer, "::after").zIndex,
                    baseToken: root.getPropertyValue("--dups-layer-live-effect").trim(),
                    topToken: root.getPropertyValue("--dups-layer-live-effect-top").trim()
                  };
                }"""
            )
            if closing_effect_layers.get("missing"):
                fail(f"{name}/{viewport_name}: Live Users drawer effect host is missing")
            else:
                try:
                    if float(closing_effect_layers["before"]) != float(closing_effect_layers["baseToken"]):
                        fail(f"{name}/{viewport_name}: closing drawer ::before layer does not match its DUPS token ({closing_effect_layers})")
                    if float(closing_effect_layers["after"]) != float(closing_effect_layers["topToken"]):
                        fail(f"{name}/{viewport_name}: closing drawer ::after layer does not match its DUPS token ({closing_effect_layers})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: closing drawer effect layers could not be resolved ({closing_effect_layers})")

        if name == "live-users":
            dialog_header_layer = page.evaluate(
                """() => {
                  const header = document.querySelector(".live-user-dialog > header");
                  const root = getComputedStyle(document.documentElement);
                  if (!header) return {missing: true};
                  const style = getComputedStyle(header);
                  return {
                    position: style.position,
                    top: parseFloat(style.top),
                    anchorTop: parseFloat(style.getPropertyValue("--dups-anchor-live-dialog-sticky-header-top")),
                    zIndex: style.zIndex,
                    token: root.getPropertyValue("--dups-layer-live-dialog-sticky-header").trim()
                  };
                }"""
            )
            if dialog_header_layer.get("missing"):
                fail(f"{name}/{viewport_name}: dialog sticky header is missing")
            else:
                try:
                    if dialog_header_layer["position"] != "sticky":
                        fail(f"{name}/{viewport_name}: dialog header is not sticky ({dialog_header_layer})")
                    if abs(dialog_header_layer["top"] - dialog_header_layer["anchorTop"]) > 1:
                        fail(f"{name}/{viewport_name}: dialog sticky header top offset differs from its DUPS anchor ({dialog_header_layer})")
                    if float(dialog_header_layer["zIndex"]) != float(dialog_header_layer["token"]):
                        fail(f"{name}/{viewport_name}: dialog sticky header z-index does not match its local DUPS token ({dialog_header_layer})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: dialog sticky header DUPS layer could not be resolved ({dialog_header_layer})")

        if name == "live-users":
            account_drawer_anchor = page.evaluate(
                """() => {
                  const drawer = document.querySelector("#liveUserDrawer");
                  const root = getComputedStyle(document.documentElement);
                  if (!drawer) return {missing: true};
                  drawer.classList.add("is-open");
                  const style = getComputedStyle(drawer);
                  const rect = drawer.getBoundingClientRect();
                  const compact = innerWidth <= 760;
                  return {
                    position: style.position,
                    zIndex: style.zIndex,
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                    expectedX: compact ? innerWidth / 2 : innerWidth * 0.544 - 90,
                    expectedY: compact ? innerHeight / 2 : innerHeight * 0.511,
                    topToken: root.getPropertyValue(compact
                      ? "--dups-anchor-live-drawer-top-compact"
                      : "--dups-anchor-live-drawer-top").trim(),
                    leftToken: root.getPropertyValue(compact
                      ? "--dups-anchor-live-drawer-left-compact"
                      : "--dups-anchor-live-drawer-left").trim(),
                    layerToken: root.getPropertyValue("--dups-layer-live-drawer").trim()
                  };
                }"""
            )
            if account_drawer_anchor.get("missing"):
                fail(f"{name}/{viewport_name}: Live Users account drawer is missing")
            else:
                try:
                    if account_drawer_anchor["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: Live Users account drawer is not viewport-fixed ({account_drawer_anchor})")
                    if abs(account_drawer_anchor["centerX"] - account_drawer_anchor["expectedX"]) > 2:
                        fail(f"{name}/{viewport_name}: Live Users account drawer horizontal anchor differs from its DUPS token ({account_drawer_anchor})")
                    if abs(account_drawer_anchor["centerY"] - account_drawer_anchor["expectedY"]) > 2:
                        fail(f"{name}/{viewport_name}: Live Users account drawer vertical anchor differs from its DUPS token ({account_drawer_anchor})")
                    if float(account_drawer_anchor["zIndex"]) != float(account_drawer_anchor["layerToken"]):
                        fail(f"{name}/{viewport_name}: Live Users account drawer layer differs from its DUPS token ({account_drawer_anchor})")
                    if account_drawer_anchor["topToken"] != ("50%" if width <= 760 else "51.1%"):
                        fail(f"{name}/{viewport_name}: Live Users account drawer top anchor token changed unexpectedly ({account_drawer_anchor})")
                    if width <= 760 and account_drawer_anchor["leftToken"] != "50%":
                        fail(f"{name}/{viewport_name}: compact Live Users account drawer left anchor is not centered ({account_drawer_anchor})")
                    if width > 760 and "54.4%" not in account_drawer_anchor["leftToken"]:
                        fail(f"{name}/{viewport_name}: desktop Live Users account drawer left anchor token changed unexpectedly ({account_drawer_anchor})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Live Users account drawer anchor/layer could not be resolved ({account_drawer_anchor})")

        if name == "live-users":
            restriction_layer = page.evaluate(
                """() => {
                  const modal = document.querySelector(".live-restrictions-modal");
                  const root = getComputedStyle(document.documentElement);
                  if (!modal) return {missing: true};
                  const style = getComputedStyle(modal);
                  const rect = modal.getBoundingClientRect();
                  return {
                    position: style.position,
                    zIndex: style.zIndex,
                    top: style.top,
                    left: style.left,
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                    viewportCenterX: innerWidth / 2,
                    viewportCenterY: innerHeight / 2,
                    layerToken: root.getPropertyValue("--dups-layer-live-drawer").trim(),
                    centerToken: root.getPropertyValue("--dups-viewport-center").trim()
                  };
                }"""
            )
            if restriction_layer.get("missing"):
                fail(f"{name}/{viewport_name}: Restricted Users modal element is missing")
            else:
                try:
                    if restriction_layer["position"] != "fixed":
                        fail(f"{name}/{viewport_name}: Restricted Users modal is not fixed-positioned ({restriction_layer})")
                    if float(restriction_layer["zIndex"]) != float(restriction_layer["layerToken"]):
                        fail(f"{name}/{viewport_name}: Restricted Users modal z-index does not match DUPS drawer token ({restriction_layer})")
                    if abs(restriction_layer["centerX"] - restriction_layer["viewportCenterX"]) > 2 or abs(restriction_layer["centerY"] - restriction_layer["viewportCenterY"]) > 2:
                        fail(f"{name}/{viewport_name}: Restricted Users modal is not viewport-centered ({restriction_layer})")
                    if restriction_layer["centerToken"] != "50%":
                        fail(f"{name}/{viewport_name}: DUPS viewport-center token changed unexpectedly ({restriction_layer})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Restricted Users modal DUPS layer/placement could not be resolved ({restriction_layer})")

        if metrics["documentWidth"] > width + 1:
            fail(
                f"{name}/{viewport_name}: horizontal document overflow "
                f"({metrics['documentWidth']}px > {width}px)"
            )
        if metrics["zeroSizeControls"]:
            fail(f"{name}/{viewport_name}: {metrics['zeroSizeControls']} visible interactive elements have zero geometry")

        for token, value in (
            ("DUSS header height", metrics["tokens"]["duss"]),
            ("DUPS header layer", metrics["tokens"]["dups"]),
            ("DUCS canvas", metrics["tokens"]["ducsBg"]),
            ("DUCS primary text", metrics["tokens"]["ducsText"]),
            ("DUCS secondary text", metrics["tokens"]["ducsSecondary"]),
            ("DUCS action color", metrics["tokens"]["ducsAction"]),
            ("DUCS border", metrics["tokens"]["ducsBorder"]),
        ):
            if not value:
                fail(f"{name}/{viewport_name}: {token} token did not resolve")

        color_pairs = (
            ("primary text/canvas", metrics["tokens"]["ducsText"], metrics["tokens"]["ducsBg"], 4.5),
            ("secondary text/canvas", metrics["tokens"]["ducsSecondary"], metrics["tokens"]["ducsBg"], 4.5),
            ("action/canvas", metrics["tokens"]["ducsAction"], metrics["tokens"]["ducsBg"], 4.5),
            ("border/canvas", metrics["tokens"]["ducsBorder"], metrics["tokens"]["ducsBg"], 3.0),
        )
        for pair_name, foreground, background, minimum in color_pairs:
            fg_rgb, bg_rgb = parse_color(foreground), parse_color(background)
            if fg_rgb is None or bg_rgb is None:
                fail(f"{name}/{viewport_name}: could not parse DUCS {pair_name} colors ({foreground!r}, {background!r})")
                continue
            ratio = contrast_ratio(fg_rgb, bg_rgb)
            if ratio + 0.01 < minimum:
                fail(f"{name}/{viewport_name}: DUCS {pair_name} contrast {ratio:.2f}:1 is below {minimum}:1")

        if name in ("profile", "admin", "upload-studio"):
            original_theme = page.locator("html").get_attribute("data-theme") or "dark"
            page.locator("html").evaluate("(el) => { el.dataset.theme = 'light'; }")
            palette = page.evaluate(
                """(pageName) => {
                  const color = el => getComputedStyle(el).color;
                  const bg = el => getComputedStyle(el).backgroundColor;
                  const getPair = (foreground, background) => ({foreground: color(foreground), background: bg(background)});
                  if (pageName === "profile") {
                    const card = document.querySelector(".profile-card");
                    const save = document.querySelector(".save-profile");
                    const label = document.querySelector(".profile-field > span");
                    const status = document.querySelector(".profile-status");
                    const remove = document.querySelector(".remove-avatar");
                    status.classList.remove("error");
                    const success = color(status);
                    status.classList.add("error");
                    const error = color(status);
                    status.classList.remove("error");
                    return {pairs: [
                      ["Profile save action", getPair(save, save)],
                      ["Profile field label", getPair(label, card)],
                      ["Profile remove-avatar action", getPair(remove, card)],
                      ["Profile success status", {foreground: success, background: bg(card)}],
                      ["Profile error status", {foreground: error, background: bg(card)}]
                    ]};
                  }
                  if (pageName === "admin") {
                    const host = document.querySelector(".admin-main");
                    const row = document.createElement("div"); row.className = "data-row";
                    const actions = document.createElement("div"); actions.className = "row-actions";
                    const button = document.createElement("button"); button.className = "delete"; button.textContent = "Delete";
                    actions.appendChild(button); row.appendChild(actions); host.appendChild(row);
                    const notice = document.createElement("p"); notice.className = "notice error"; notice.textContent = "Error"; host.appendChild(notice);
                    const login = document.querySelector(".admin-login-panel");
                    const loginLabel = login?.querySelector(".admin-login-form label");
                    const loginInput = login?.querySelector(".admin-login-form input");
                    const loginButton = login?.querySelector(".admin-login-form button.primary");
                    const result = {pairs: [
                      ["Admin delete action", getPair(button, button)],
                      ["Admin error feedback", {foreground: color(notice), background: bg(document.body)}],
                      ["Admin login label", loginLabel && login ? getPair(loginLabel, login) : null],
                      ["Admin login field", loginInput ? getPair(loginInput, loginInput) : null],
                      ["Admin login action", loginButton ? getPair(loginButton, loginButton) : null]
                    ]};
                    row.remove(); notice.remove(); return result;
                  }
                  const sidebar = document.querySelector(".sidebar");
                  const secondary = document.querySelector(".secondary-button");
                  const inline = document.querySelector(".url-row button");
                  const formMessage = document.querySelector(".form-message");
                  const sideLink = sidebar?.querySelector(".side-nav a");
                  formMessage?.classList.remove("error");
                  const success = formMessage ? color(formMessage) : "";
                  formMessage?.classList.add("error");
                  const error = formMessage ? color(formMessage) : "";
                  formMessage?.classList.remove("error");
                  return {pairs: [
                    ["Upload Studio secondary action", secondary ? getPair(secondary, secondary) : null],
                    ["Upload Studio inline action", inline ? getPair(inline, inline) : null],
                    ["Upload Studio sidebar link", sideLink && sidebar ? getPair(sideLink, sidebar) : null],
                    ["Upload Studio success feedback", formMessage ? {foreground: success, background: bg(document.querySelector(".panel"))} : null],
                    ["Upload Studio error feedback", formMessage ? {foreground: error, background: bg(document.querySelector(".panel"))} : null]
                  ]};
                }""",
                name,
            )
            for label, pair in palette["pairs"]:
                if pair is None:
                    continue
                fg_rgb, bg_rgb = parse_color(pair["foreground"]), parse_color(pair["background"])
                if fg_rgb is None or bg_rgb is None:
                    fail(f"{name}/{viewport_name}: could not parse Light Mode {label} colors ({pair})")
                    continue
                ratio = contrast_ratio(fg_rgb, bg_rgb)
                if ratio + 0.01 < 4.5:
                    fail(f"{name}/{viewport_name}: Light Mode {label} contrast {ratio:.2f}:1 is below 4.5:1 ({pair})")
            page.locator("html").evaluate("(el, theme) => { el.dataset.theme = theme; }", original_theme)

        if asset_errors:
            fail(f"{name}/{viewport_name}: failed local CSS/JS assets: {'; '.join(asset_errors[:5])}")

        if metrics["undersizedCount"]:
            WARNINGS.append(
                f"{name}/{viewport_name}: {metrics['undersizedCount']} visible interactive targets below 44px; "
                f"examples={metrics['undersizedExamples']}"
            )

        if viewport_name == "desktop":
            page.keyboard.press("Tab")
            focus = page.evaluate(
                """() => {
                  const el = document.activeElement;
                  const style = getComputedStyle(el);
                  return {
                    tag: el ? el.tagName.toLowerCase() : "",
                    id: el ? el.id : "",
                    isBody: !el || el === document.body,
                    outlineStyle: style.outlineStyle,
                    outlineWidth: style.outlineWidth,
                    boxShadow: style.boxShadow
                  };
                }"""
            )
            if focus["isBody"]:
                fail(f"{name}/desktop: keyboard Tab did not move focus to an interactive element")
            elif (
                focus["outlineStyle"] == "none"
                or focus["outlineWidth"] in ("0px", "0")
            ) and focus["boxShadow"] == "none":
                fail(f"{name}/desktop: first keyboard-focused element has no visible focus indicator ({focus})")

    except Exception as exc:
        fail(f"{name}/{viewport_name}: browser check raised {type(exc).__name__}: {exc}")
    finally:
        context.close()


def inspect_drawer(browser, base_url, name, config, reduced_motion):
    route, toggle, sidebar, backdrop, uses_dume = config
    if not uses_dume:
        return
    mode = "reduced-motion" if reduced_motion else "normal-motion"
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        locale="bn-BD",
        is_mobile=True,
        has_touch=True,
        reduced_motion="reduce" if reduced_motion else "no-preference",
    )
    context.route("https://**/*", lambda request_route: request_route.abort())
    page = context.new_page()
    try:
        page.goto(base_url + route, wait_until="load", timeout=30000)
        page.wait_for_function("() => Boolean(window.DRMMotion)", timeout=10000)
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle, sidebar}) => {
              const button = document.querySelector(toggle);
              const panel = document.querySelector(sidebar);
              return button?.getAttribute("aria-expanded") === "true"
                && document.body.classList.contains("drawer-open")
                && panel?.classList.contains("mobile-open");
            }""",
            arg={"toggle": toggle, "sidebar": sidebar},
            timeout=5000,
        )
        transition = page.locator(sidebar).evaluate("(el) => getComputedStyle(el).transitionDuration")
        durations = [value.strip() for value in transition.split(",")]
        motion_config = page.evaluate("() => window.DRMMotion.config")

        def duration_ms(value: str) -> float:
            if value.endswith("ms"):
                return float(value[:-2])
            if value.endswith("s"):
                return float(value[:-1]) * 1000
            return float(value or "0")

        actual_durations = [duration_ms(value) for value in durations]
        expected_durations = (
            [0.0, 0.0]
            if reduced_motion
            else [
                float(motion_config["drawerDuration"]),
                min(
                    float(motion_config["drawerDuration"]),
                    float(motion_config["drawerOpacityDuration"]),
                ),
            ]
        )
        if len(actual_durations) != 2 or any(
            abs(actual - expected) > 1
            for actual, expected in zip(actual_durations, expected_durations)
        ):
            fail(
                f"{name}/{mode}: computed transition durations {actual_durations}ms "
                f"do not match DUME token durations {expected_durations}ms"
            )
        if page.locator(backdrop).evaluate("(el) => el.hidden"):
            fail(f"{name}/{mode}: backdrop remained hidden while drawer was open")

        containing_blocks = page.locator(sidebar).evaluate(
            """(element) => {
              const offenders = [];
              let ancestor = element.parentElement;
              while (ancestor && ancestor !== document.documentElement) {
                const style = getComputedStyle(ancestor);
                const contain = style.contain.split(/\\s+/);
                const willChange = style.willChange.split(/,\\s*/);
                const createsFixedContainingBlock =
                  style.transform !== "none"
                  || style.perspective !== "none"
                  || style.filter !== "none"
                  || style.backdropFilter !== "none"
                  || contain.some(value => ["paint", "layout", "strict", "content"].includes(value))
                  || willChange.some(value => ["transform", "perspective", "filter"].includes(value));
                if (createsFixedContainingBlock) {
                  offenders.push({
                    tag: ancestor.tagName.toLowerCase(),
                    id: ancestor.id,
                    className: typeof ancestor.className === "string" ? ancestor.className.slice(0, 80) : "",
                    transform: style.transform,
                    perspective: style.perspective,
                    filter: style.filter,
                    backdropFilter: style.backdropFilter,
                    contain: style.contain,
                    willChange: style.willChange
                  });
                }
                ancestor = ancestor.parentElement;
              }
              return {position: getComputedStyle(element).position, offenders};
            }"""
        )
        if containing_blocks["position"] == "fixed" and containing_blocks["offenders"]:
            fail(
                f"{name}/{mode}: fixed drawer is captured by an ancestor containing block "
                f"({containing_blocks['offenders']})"
            )
        backdrop_containing_blocks = page.locator(backdrop).evaluate(
            """(element) => {
              const offenders = [];
              let ancestor = element.parentElement;
              while (ancestor && ancestor !== document.documentElement) {
                const style = getComputedStyle(ancestor);
                if (style.transform !== "none" || style.perspective !== "none"
                    || style.filter !== "none" || style.backdropFilter !== "none"
                    || /(^|\\s)(paint|layout|strict|content)(\\s|$)/.test(style.contain)
                    || /(^|,\\s*)(transform|perspective|filter)(\\s*,|$)/.test(style.willChange)) {
                  offenders.push({tag: ancestor.tagName.toLowerCase(), id: ancestor.id,
                    className: typeof ancestor.className === "string" ? ancestor.className.slice(0, 80) : ""});
                }
                ancestor = ancestor.parentElement;
              }
              return {position: getComputedStyle(element).position, offenders};
            }"""
        )
        if backdrop_containing_blocks["position"] == "fixed" and backdrop_containing_blocks["offenders"]:
            fail(
                f"{name}/{mode}: fixed backdrop is captured by an ancestor containing block "
                f"({backdrop_containing_blocks['offenders']})"
            )

        layers = page.evaluate(
            """({sidebar, backdrop}) => {
              const root = getComputedStyle(document.documentElement);
              const value = (name) => root.getPropertyValue(name).trim();
              return {
                sidebar: getComputedStyle(document.querySelector(sidebar)).zIndex,
                backdrop: getComputedStyle(document.querySelector(backdrop)).zIndex,
                header: getComputedStyle(document.querySelector("header")).zIndex,
                tokens: {
                  sidebar: value("--dups-layer-sidebar-mobile"),
                  backdrop: value("--dups-layer-sidebar-backdrop"),
                  homeSidebar: value("--dups-layer-home-sidebar-mobile"),
                  homeBackdrop: value("--dups-layer-home-sidebar-backdrop")
                }
              };
            }""",
            arg={"sidebar": sidebar, "backdrop": backdrop},
        )
        expected_sidebar = layers["tokens"]["homeSidebar"] if name in ("homepage", "movies") else layers["tokens"]["sidebar"]
        expected_backdrop = layers["tokens"]["homeBackdrop"] if name in ("homepage", "movies") else layers["tokens"]["backdrop"]
        try:
            actual_sidebar = float(layers["sidebar"])
            actual_backdrop = float(layers["backdrop"])
            actual_header = float(layers["header"])
            if actual_sidebar != float(expected_sidebar):
                fail(
                    f"{name}/{mode}: sidebar z-index {actual_sidebar:g} does not match "
                    f"DUPS token {float(expected_sidebar):g}"
                )
            if actual_backdrop != float(expected_backdrop):
                fail(
                    f"{name}/{mode}: backdrop z-index {actual_backdrop:g} does not match "
                    f"DUPS token {float(expected_backdrop):g}"
                )
            # The homepage/admin overlay covers the header; Live Users and
            # Upload Studio intentionally keep their fixed header above it.
            valid_order = (
                actual_sidebar > actual_backdrop > actual_header
                if name in ("homepage", "movies", "admin")
                else actual_header > actual_sidebar > actual_backdrop
            )
            if not valid_order:
                fail(
                    f"{name}/{mode}: unexpected overlay stack "
                    f"(header={actual_header:g}, sidebar={actual_sidebar:g}, backdrop={actual_backdrop:g})"
                )
        except (TypeError, ValueError):
            fail(f"{name}/{mode}: DUPS computed stacking values could not be parsed ({layers})")

        # Close during the transition to exercise cancellation of stale timers.
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle}) => document.querySelector(toggle)?.getAttribute("aria-expanded") === "false"
              && !document.body.classList.contains("drawer-open")""",
            arg={"toggle": toggle},
            timeout=5000,
        )
        # DUME keeps the mobile-open class until its transition cleanup timer
        # expires (duration + 40ms); wait for the actual lifecycle completion.
        page.wait_for_function(
            """({sidebar}) => !document.querySelector(sidebar)?.classList.contains("mobile-open")
              && !document.body.classList.contains("drawer-open")""",
            arg={"sidebar": sidebar},
            timeout=2500,
        )
        if not page.locator(backdrop).evaluate("(el) => el.hidden"):
            fail(f"{name}/{mode}: backdrop remained visible after the drawer finished closing")
    except Exception as exc:
        fail(f"{name}/{mode}: drawer interaction failed: {type(exc).__name__}: {exc}")
    finally:
        context.close()


def inspect_breakpoint(browser, base_url, name, config):
    route, toggle, sidebar, _backdrop, uses_dume = config
    if not uses_dume:
        return
    context = browser.new_context(
        viewport={"width": 761, "height": 900},
        locale="bn-BD",
        reduced_motion="reduce",
    )
    context.route("https://**/*", lambda request_route: request_route.abort())
    page = context.new_page()
    try:
        page.goto(base_url + route, wait_until="load", timeout=30000)
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle}) => document.querySelector(toggle)?.getAttribute("aria-expanded") === "true"
              && document.body.classList.contains("sidebar-open")""",
            arg={"toggle": toggle},
            timeout=5000,
        )
        if page.locator(sidebar).evaluate("(el) => el.classList.contains('dume-mobile-drawer')"):
            fail(f"{name}/breakpoint-761: mobile DUME controller incorrectly took the desktop path")
    except Exception as exc:
        fail(f"{name}/breakpoint-761: desktop-side menu behavior failed: {type(exc).__name__}: {exc}")
    finally:
        context.close()


def inspect_resize_transition(browser, base_url, name, config):
    route, toggle, sidebar, backdrop, uses_dume = config
    if not uses_dume:
        return
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        locale="bn-BD",
        is_mobile=True,
        has_touch=True,
        reduced_motion="no-preference",
    )
    context.route("https://**/*", lambda request_route: request_route.abort())
    page = context.new_page()
    stage = "opening mobile drawer"
    try:
        page.goto(base_url + route, wait_until="load", timeout=30000)
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle, sidebar}) => document.querySelector(toggle)?.getAttribute("aria-expanded") === "true"
              && document.querySelector(sidebar)?.classList.contains("mobile-open")
              && document.body.classList.contains("drawer-open")""",
            arg={"toggle": toggle, "sidebar": sidebar},
            timeout=5000,
        )

        stage = "waiting for desktop resize cleanup"
        page.set_viewport_size({"width": 761, "height": 900})
        page.wait_for_timeout(80)
        page.wait_for_function(
            """({toggle, sidebar, backdrop}) => {
              const button = document.querySelector(toggle);
              const panel = document.querySelector(sidebar);
              const overlay = document.querySelector(backdrop);
              return button?.getAttribute("aria-expanded") === "false"
                && !document.body.classList.contains("drawer-open")
                && !document.body.classList.contains("sidebar-open")
                && !panel?.classList.contains("mobile-open")
                && !panel?.classList.contains("dume-mobile-drawer")
                && overlay?.hidden === true
                && !overlay?.classList.contains("dume-mobile-backdrop")
                && !overlay?.classList.contains("is-closing");
            }""",
            arg={"toggle": toggle, "sidebar": sidebar, "backdrop": backdrop},
            timeout=5000,
        )

        stage = "reopening after returning to mobile"
        page.set_viewport_size({"width": 390, "height": 844})
        # Let the matchMedia change event and each page's breakpoint-close
        # handler finish before sending a new user interaction.
        page.wait_for_function("() => innerWidth === 390 && matchMedia('(max-width:760px)').matches", timeout=5000)
        page.wait_for_timeout(120)
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle, sidebar}) => document.querySelector(toggle)?.getAttribute("aria-expanded") === "true"
              && document.querySelector(sidebar)?.classList.contains("mobile-open")
              && document.body.classList.contains("drawer-open")""",
            arg={"toggle": toggle, "sidebar": sidebar},
            timeout=5000,
        )
        stage = "closing after returning to mobile"
        page.locator(toggle).dispatch_event("click")
        page.wait_for_function(
            """({toggle}) => document.querySelector(toggle)?.getAttribute("aria-expanded") === "false"
              && !document.body.classList.contains("drawer-open")""",
            arg={"toggle": toggle},
            timeout=5000,
        )
        page.wait_for_function(
            """({sidebar, backdrop}) => !document.querySelector(sidebar)?.classList.contains("mobile-open")
              && !document.body.classList.contains("drawer-open")
              && document.querySelector(backdrop)?.hidden === true""",
            arg={"sidebar": sidebar, "backdrop": backdrop},
            timeout=2500,
        )
    except Exception as exc:
        snapshot = page.evaluate(
            """({toggle, sidebar, backdrop}) => {
              const button = document.querySelector(toggle);
              const panel = document.querySelector(sidebar);
              const overlay = document.querySelector(backdrop);
              return {
                innerWidth,
                mobileMedia: matchMedia("(max-width:760px)").matches,
                ariaExpanded: button?.getAttribute("aria-expanded"),
                bodyDrawerOpen: document.body.classList.contains("drawer-open"),
                bodySidebarOpen: document.body.classList.contains("sidebar-open"),
                mobileOpen: panel?.classList.contains("mobile-open"),
                dumeDrawer: panel?.classList.contains("dume-mobile-drawer"),
                backdropHidden: overlay?.hidden,
                backdropDume: overlay?.classList.contains("dume-mobile-backdrop"),
                backdropClosing: overlay?.classList.contains("is-closing")
              };
            }""",
            arg={"toggle": toggle, "sidebar": sidebar, "backdrop": backdrop},
        )
        fail(
            f"{name}/mobile-to-desktop-resize ({stage}): "
            f"{type(exc).__name__}: {exc}; snapshot={snapshot}"
        )
    finally:
        context.close()

def inspect_live_overlay_lifecycle_source():
    """Guard shared overlay state against timer races and nested-dialog unlocks."""
    source = Path("live-users.js").read_text(encoding="utf-8")
    required = {
        "centralized backdrop and scroll-lock ownership": "function syncOverlayLifecycle()",
        "drawer close animation keeps overlay active": "overlayState.drawerClosing=true;syncOverlayLifecycle()",
        "restriction hand-off retains shared backdrop": "overlayState.restrictionHandoff=Boolean(keepBackdrop);syncOverlayLifecycle()",
        "native dialog joins shared overlay state": "overlayState.dialog=true;syncOverlayLifecycle()",
        "native dialog close releases only its own state": "overlayState.dialog=false;syncOverlayLifecycle()",
        "close timers cleared on page exit": "clearTimeout(drawerCloseTimer);clearTimeout(restrictionCloseTimer)",
    }
    for label, marker in required.items():
        if marker not in source:
            fail(f"live-users/overlay-lifecycle: missing {label}")



def inspect_live_overlay_interactions(browser, base_url):
    """Exercise the real Live Users drawer/modal/dialog lifecycle with isolated API fixtures."""
    import json

    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="bn-BD",
        reduced_motion="reduce",
    )
    page = context.new_page()
    user = {
        "id": "overlay-test-user",
        "name": "Overlay Test User",
        "username": "unique-overlay-handle",
        "email": "overlay-user@example.invalid",
        "role": "user",
        "created_at": 1760000000,
        "email_verified": True,
    }
    banned = {
        "id": "overlay-test-banned",
        "name": "Restricted Test User",
        "username": "restricted-test",
        "email": "restricted-test@example.invalid",
        "role": "user",
        "created_at": 1750000000,
        "email_verified": True,
        "restriction_type": "ban",
        "restriction_expires_at": None,
        "restriction_reason": "browser fixture",
    }

    def api_fixture(route):
        path = route.request.url.split("?", 1)[0]
        if path.endswith("/api/auth/status"):
            payload = {"configured": True}
        elif path.endswith("/api/auth/me"):
            payload = {"authenticated": True, "user": {"id": "owner", "role": "owner"}}
        elif path.endswith("/api/admin/active-users"):
            payload = {"admins": [], "members": [user], "guests": []}
        elif path.endswith("/api/admin/users"):
            payload = [user, banned]
        elif path.endswith("/api/presence") or path.endswith("/api/admin/presence"):
            payload = {"ok": True}
        else:
            route.fulfill(status=404, content_type="application/json", body='{"error":"unexpected test API request"}')
            return
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

    try:
        page.route("**/api/**", api_fixture)
        page.route("https://**/*", lambda route: route.abort())
        page.goto(base_url + "/live-users.html", wait_until="load", timeout=30000)
        page.wait_for_selector('.live-user-row[data-user-id="overlay-test-user"]', timeout=10000)

        # Search contract: username, display name and email are all searchable.
        page.locator("#liveSearch").fill("unique-overlay-handle")
        if not page.locator('.live-user-row[data-user-id="overlay-test-user"]').is_visible():
            fail("live-users/search: an active account was not found by its username")
        page.locator("#liveSearch").fill("overlay-user@example.invalid")
        if not page.locator('.live-user-row[data-user-id="overlay-test-user"]').is_visible():
            fail("live-users/search: an active account was not found by its email address")
        page.locator("#liveSearch").fill("Overlay Test User")
        if not page.locator('.live-user-row[data-user-id="overlay-test-user"]').is_visible():
            fail("live-users/search: an active account was not found by its display name")
        page.locator("#liveSearch").fill("")

        # Drawer close must retain the shared backdrop and scroll lock until its
        # close animation cleanup timer finishes.
        page.locator('.live-user-row[data-user-id="overlay-test-user"]').click()
        page.wait_for_function(
            "() => document.querySelector('#liveUserDrawer')?.classList.contains('is-open') && document.body.style.overflow === 'hidden' && !document.querySelector('#liveDrawerBackdrop')?.hidden",
            timeout=5000,
        )
        if page.locator("#liveUserDrawer").get_attribute("role") != "dialog" or page.locator("#liveUserDrawer").get_attribute("aria-modal") != "true" or page.locator("#liveUserDrawer").evaluate("(el) => el.inert"):
            fail("live-users/overlay-interaction: open account drawer is missing modal semantics or is inert")
        page.locator("html").evaluate("(el) => { el.dataset.theme = 'light'; }")
        live_drawer_pairs = page.evaluate(
            """() => {
              const drawer = document.querySelector("#liveUserDrawer");
              const profile = drawer.querySelector(".live-drawer-profile");
              const actions = [...drawer.querySelectorAll(".live-drawer-action")];
              const effectiveBackground = element => {
                let current = element;
                while (current) {
                  const value = getComputedStyle(current).backgroundColor;
                  if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") return value;
                  current = current.parentElement;
                }
                return "rgb(248, 250, 252)";
              };
              const pair = (foreground, background) => ({
                foreground: getComputedStyle(foreground).color,
                background: effectiveBackground(background)
              });
              const warning = actions.find(el => el.classList.contains("warning"));
              const danger = actions.find(el => el.classList.contains("danger"));
              const roleBadges = ["owner", "admin", "member"].map(role => {
                const badge = document.createElement("span");
                badge.className = "live-drawer-chip role-badge role-badge--" + role;
                badge.textContent = role;
                drawer.appendChild(badge);
                return [role, pair(badge, badge)];
              });
              roleBadges.forEach(([role]) => drawer.querySelector(".role-badge--" + role)?.remove());
              return [
                ["Live Users drawer title", pair(drawer.querySelector("h2"), drawer)],
                ["Live Users drawer profile name", pair(profile.querySelector("strong"), profile)],
                ["Live Users drawer account email", pair(profile.querySelector("small"), profile)],
                ["Live Users drawer metadata chip", pair(drawer.querySelector(".live-drawer-chip"), drawer.querySelector(".live-drawer-chip"))],
                ...roleBadges.map(([role, colors]) => ["Live Users " + role + " role badge", colors]),
                ["Live Users standard action", pair(actions.find(el => !el.classList.contains("warning") && !el.classList.contains("danger")), actions.find(el => !el.classList.contains("warning") && !el.classList.contains("danger")))],
                ["Live Users warning action", warning ? pair(warning, warning) : null],
                ["Live Users danger action", danger ? pair(danger, danger) : null]
              ];
            }"""
        )
        for label, pair in live_drawer_pairs:
            if pair is None:
                continue
            fg_rgb, bg_rgb = parse_color(pair["foreground"]), parse_color(pair["background"])
            if fg_rgb is None or bg_rgb is None or contrast_ratio(fg_rgb, bg_rgb) + 0.01 < 4.5:
                ratio = contrast_ratio(fg_rgb, bg_rgb) if fg_rgb and bg_rgb else 0
                fail(f"live-users/overlay-interaction: Light Mode {label} contrast {ratio:.2f}:1 is below 4.5:1 ({pair})")
        if page.evaluate("() => document.activeElement?.id") != "liveDrawerClose":
            fail("live-users/overlay-interaction: opening the account drawer did not move focus to its close control")
        page.locator("#liveDrawerBody button").last.focus()
        page.keyboard.press("Tab")
        if page.evaluate("() => document.activeElement?.id") != "liveDrawerClose":
            fail("live-users/overlay-interaction: Tab did not wrap from the last account action to the drawer close control")
        page.locator("#liveDrawerClose").focus()
        page.keyboard.press("Shift+Tab")
        if page.evaluate("() => document.activeElement?.dataset?.action") != "ban":
            fail("live-users/overlay-interaction: Shift+Tab did not wrap from drawer close to the last account action")
        page.locator("#liveDrawerClose").focus()
        backdrop_geometry = page.locator("#liveDrawerBackdrop").evaluate(
            """el => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              const zero = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dups-offset-0"));
              return {position: style.position, top: parseFloat(style.top), right: parseFloat(style.right),
                bottom: parseFloat(style.bottom), left: parseFloat(style.left), zero,
                rect: {top: rect.top, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom, left: rect.left}};
            }"""
        )
        if backdrop_geometry["position"] != "fixed" or any(
            abs(backdrop_geometry[edge] - backdrop_geometry["zero"]) > 1
            for edge in ("top", "right", "bottom", "left")
        ):
            fail(f"live-users/overlay-interaction: drawer backdrop does not cover the viewport using the DUPS zero-offset token ({backdrop_geometry})")
        page.locator("#liveDrawerClose").click()
        page.wait_for_timeout(140)
        if page.evaluate("() => document.body.style.overflow") != "hidden":
            fail("live-users/overlay-interaction: scroll lock released before drawer close animation completed")
        if page.locator("#liveDrawerBackdrop").evaluate("(el) => el.hidden"):
            fail("live-users/overlay-interaction: shared backdrop disappeared during drawer close animation")
        page.wait_for_function(
            "() => document.body.style.overflow === '' && document.querySelector('#liveDrawerBackdrop')?.hidden",
            timeout=2500,
        )

        # Block List close follows the same delayed cleanup contract.
        page.locator("#liveRestrictionsOpen").click()
        page.wait_for_function(
            "() => document.querySelector('#liveRestrictionsModal')?.classList.contains('is-open') && document.body.style.overflow === 'hidden'",
            timeout=5000,
        )
        if page.locator("#liveRestrictionsModal").get_attribute("role") != "dialog" or page.locator("#liveRestrictionsModal").get_attribute("aria-modal") != "true" or page.locator("#liveRestrictionsModal").evaluate("(el) => el.inert"):
            fail("live-users/overlay-interaction: open Block List window is missing modal semantics or is inert")
        banned_row = page.locator('.live-restricted-user-row[data-restricted-user-id="overlay-test-banned"]')
        if not banned_row.count():
            fail("live-users/overlay-interaction: expected banned fixture row was not rendered")
        else:
            restricted_pairs = banned_row.evaluate(
                """row => {
                  const copy = row.querySelector(".live-restricted-copy");
                  const status = row.querySelector(".live-restricted-status");
                  const pair = (foreground, background) => ({
                    foreground: getComputedStyle(foreground).color,
                    background: getComputedStyle(background).backgroundColor
                  });
                  return [
                    ["Block List username", pair(copy.querySelector("strong"), row)],
                    ["Block List email metadata", pair(copy.querySelector("small"), row)],
                    ["Block List restriction status", pair(status, status)]
                  ];
                }"""
            )
            for label, pair in restricted_pairs:
                fg_rgb, bg_rgb = parse_color(pair["foreground"]), parse_color(pair["background"])
                if fg_rgb is None or bg_rgb is None or contrast_ratio(fg_rgb, bg_rgb) + 0.01 < 4.5:
                    ratio = contrast_ratio(fg_rgb, bg_rgb) if fg_rgb and bg_rgb else 0
                    fail(f"live-users/overlay-interaction: Light Mode {label} contrast {ratio:.2f}:1 is below 4.5:1 ({pair})")
        if page.evaluate("() => document.activeElement?.id") != "liveRestrictionsClose":
            fail("live-users/overlay-interaction: opening Block List did not move focus to its close control")
        page.locator("#liveBannedTab").focus()
        page.keyboard.press("ArrowRight")
        if page.evaluate("() => document.activeElement?.id") != "liveSuspendedTab" or page.locator("#liveSuspendedTab").get_attribute("aria-selected") != "true" or page.locator("#liveRestrictionsList").get_attribute("aria-labelledby") != "liveSuspendedTab":
            fail("live-users/overlay-interaction: Block List arrow-key navigation or tab-panel labelling is incorrect")
        page.keyboard.press("ArrowLeft")
        if page.evaluate("() => document.activeElement?.id") != "liveBannedTab" or page.locator("#liveBannedTab").get_attribute("aria-selected") != "true":
            fail("live-users/overlay-interaction: Block List reverse tab navigation did not restore Banned")
        page.locator("#liveDrawerBackdrop").click()
        page.wait_for_timeout(120)
        if page.evaluate("() => document.body.style.overflow") != "hidden":
            fail("live-users/overlay-interaction: scroll lock released before restrictions modal close completed")
        page.wait_for_function(
            "() => document.body.style.overflow === '' && document.querySelector('#liveDrawerBackdrop')?.hidden",
            timeout=2000,
        )
        if page.evaluate("() => document.activeElement?.id") != "liveRestrictionsOpen":
            fail("live-users/overlay-interaction: closing Block List did not restore focus to its opener")

        # Restriction-list to account-drawer handoff must never expose the page.
        page.locator("#liveRestrictionsOpen").click()
        page.wait_for_selector('.live-restricted-user-row[data-restricted-user-id="overlay-test-banned"]', timeout=5000)
        page.locator('.live-restricted-user-row[data-restricted-user-id="overlay-test-banned"]').click()
        page.wait_for_function(
            "() => document.querySelector('#liveUserDrawer')?.classList.contains('is-open') && document.body.style.overflow === 'hidden' && !document.querySelector('#liveDrawerBackdrop')?.hidden",
            timeout=5000,
        )

        # A native dialog opened during drawer-close cleanup must inherit the
        # shared lock; closing it must not cancel the still-running drawer close.
        page.locator('[data-action="details"]').click()
        page.wait_for_function(
            "() => document.querySelector('#liveUserDialog')?.open && document.body.style.overflow === 'hidden'",
            timeout=5000,
        )
        page.locator("#liveDialogClose").click()
        page.wait_for_timeout(120)
        if page.evaluate("() => document.body.style.overflow") != "hidden":
            fail("live-users/overlay-interaction: native dialog close unlocked the page while drawer close was still active")
        page.wait_for_function(
            "() => document.body.style.overflow === '' && document.querySelector('#liveDrawerBackdrop')?.hidden && !document.querySelector('#liveUserDialog')?.open",
            timeout=2500,
        )
        if page.evaluate("() => document.activeElement?.id") != "liveRestrictionsOpen":
            fail("live-users/overlay-interaction: closing the account drawer/dialog handoff did not restore focus to the originating control")

        # Fixed overlays live directly under body, avoiding transformed or
        # contained intermediate ancestors that would redefine their viewport.
        ancestry = page.evaluate(
            """() => ["#liveDrawerBackdrop", "#liveUserDrawer", "#liveRestrictionsModal", "#liveUserDialog"].map(selector => {
              const element = document.querySelector(selector);
              return {selector, directBodyChild: element?.parentElement === document.body};
            })"""
        )
        for item in ancestry:
            if not item["directBodyChild"]:
                fail(f"live-users/overlay-interaction: {item['selector']} is no longer a direct body child; fixed containing-block ancestry needs review ({item})")
    except Exception as exc:
        fail(f"live-users/overlay-interaction: {type(exc).__name__}: {exc}")
    finally:
        context.close()

def inspect_dufs_dropdown_lifecycle(browser, base_url):
    """Exercise all seven DUFS category dropdowns and their DUME lifecycle."""
    scenarios = [
        ("desktop-normal", 1440, 900, False),
        ("mobile-normal", 390, 844, False),
        ("mobile-reduced", 390, 844, True),
    ]
    keys = [
        "all-movies", "dubbed-movies", "country", "collections",
        "genre", "subtitles", "year",
    ]

    for scenario, width, height, reduced_motion in scenarios:
        context = browser.new_context(
            viewport={"width": width, "height": height},
            locale="bn-BD",
            is_mobile=width <= 760,
            has_touch=width <= 760,
            reduced_motion="reduce" if reduced_motion else "no-preference",
        )
        page = context.new_page()
        try:
            page.route("https://**/*", lambda route: route.abort())
            page.route(
                "**/api/dufs/folder-name-overrides",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"ok":true,"overrides":{}}',
                ),
            )
            page.route(
                "**/api/dufs/browse*",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"system":"DUFS","folders":[],"movies":[]}',
                ),
            )
            page.goto(base_url + "/movies", wait_until="load", timeout=30000)
            page.wait_for_selector("#dumcHomeCategories .dufn-tab", timeout=10000)
            page.wait_for_function(
                "() => document.querySelectorAll('#dumcHomeCategories .dufn-tab').length === 7"
            )
            config = page.evaluate("() => window.DRMMotion?.config || null")
            if not config:
                fail(f"movies/DUFS/{scenario}: DUME controller did not load")
                continue
            if bool(config["reducedMotion"]) != reduced_motion:
                fail(f"movies/DUFS/{scenario}: reduced-motion preference was not reflected by DUME")

            for key in keys:
                tab = page.locator(f'[data-category-menu="{key}"]')
                panel = page.locator(f"#dufnFolderPanel-{key}")
                if tab.count() != 1 or panel.count() != 1:
                    fail(f"movies/DUFS/{scenario}: {key} dropdown is missing or duplicated")
                    continue
                if tab.get_attribute("aria-expanded") != "false" or not panel.evaluate("(el) => el.hidden"):
                    fail(f"movies/DUFS/{scenario}: {key} dropdown must start closed")

                if width > 760:
                    tab.hover()
                    page.wait_for_timeout(80)
                    if tab.get_attribute("aria-expanded") != "false":
                        fail(f"movies/DUFS/{scenario}: hovering {key} must not open its dropdown")

                # First click opens; second click on the same category closes.
                tab.dispatch_event("click")
                page.wait_for_function(
                    """({key}) => {
                      const button = document.querySelector('[data-category-menu="' + key + '"]');
                      const panel = document.querySelector("#dufnFolderPanel-" + key);
                      return button?.getAttribute("aria-expanded") === "true"
                        && panel && !panel.hidden
                        && panel.getAttribute("aria-hidden") === "false"
                        && !panel.inert;
                    }""",
                    arg={"key": key},
                    timeout=5000,
                )
                opening = panel.evaluate(
                    """el => ({
                      running: el.getAnimations().filter(a => a.playState === "running").map(a => {
                        const timing = a.effect.getTiming();
                        const frames = a.effect.getKeyframes();
                        return {duration: timing.duration, easing: timing.easing, frames};
                      }),
                      hidden: el.hidden,
                      ariaHidden: el.getAttribute("aria-hidden"),
                      inert: el.inert
                    })"""
                )
                if key == "all-movies" and scenario == "desktop-normal":
                    original_theme = page.locator("html").get_attribute("data-theme") or "dark"
                    dark_palette = panel.evaluate(
                        """el => {
                          const count = getComputedStyle(el.querySelector(".dufn-panel-count"));
                          const close = getComputedStyle(el.querySelector(".dufn-panel-close"));
                          return {
                            panel: getComputedStyle(el).backgroundColor,
                            count: count.color, countOpacity: Number(count.opacity), countSize: parseFloat(count.fontSize),
                            close: close.color, closeBg: close.backgroundColor
                          };
                        }"""
                    )
                    page.locator("html").evaluate("(el) => { el.dataset.theme = 'light'; }")
                    light_palette = panel.evaluate(
                        """el => {
                          const count = getComputedStyle(el.querySelector(".dufn-panel-count"));
                          const close = getComputedStyle(el.querySelector(".dufn-panel-close"));
                          return {
                            panel: getComputedStyle(el).backgroundColor,
                            count: count.color, countOpacity: Number(count.opacity), countSize: parseFloat(count.fontSize),
                            close: close.color, closeBg: close.backgroundColor
                          };
                        }"""
                    )
                    page.locator("html").evaluate("(el, theme) => { el.dataset.theme = theme; }", original_theme)
                    for theme_name, palette in (("dark", dark_palette), ("light", light_palette)):
                        count_ratio = contrast_ratio(parse_color(palette["count"]), parse_color(palette["panel"]))
                        close_ratio = contrast_ratio(parse_color(palette["close"]), parse_color(palette["closeBg"]))
                        if count_ratio < 4.5 or palette["countOpacity"] < .99 or palette["countSize"] < 12:
                            fail(f"movies/DUFS/{scenario}: {theme_name} folder-count label does not meet readable text styling ({palette}, contrast={count_ratio:.2f}:1)")
                        if close_ratio < 4.5:
                            fail(f"movies/DUFS/{scenario}: {theme_name} dropdown close control text contrast is below 4.5:1 ({palette}, contrast={close_ratio:.2f}:1)")
                if reduced_motion:
                    if opening["running"]:
                        fail(f"movies/DUFS/{scenario}: {key} animated despite reduced-motion preference")
                else:
                    if not opening["running"]:
                        fail(f"movies/DUFS/{scenario}: {key} did not use the DUME opening animation")
                    for timing in opening["running"]:
                        if abs(float(timing["duration"]) - float(config["dropdownDuration"])) > 1:
                            fail(f"movies/DUFS/{scenario}: {key} opening duration does not match the DUME token")
                        heights = [float(frame.get("height", "0px").replace("px", "")) for frame in timing["frames"]]
                        if len(heights) < 2 or heights[0] > 1 or heights[-1] <= heights[0]:
                            fail(f"movies/DUFS/{scenario}: {key} opening did not expand the actual list area from 0px to its full height")
                        if float(timing["duration"]) != 700 or float(config["dropdownDuration"]) != float(config["drawerDuration"]):
                            fail(f"movies/DUFS/{scenario}: {key} opening does not match the Movies-page 700ms DUME extended-area motion")
                        if [float(x) for x in re.findall(r"[-+]?(?:\d*\.)?\d+", timing["easing"])] != [float(x) for x in re.findall(r"[-+]?(?:\d*\.)?\d+", config["dropdownEasing"])] :
                            fail(f"movies/DUFS/{scenario}: {key} opening easing does not match the DUME token")
                    page.wait_for_timeout(float(config["dropdownDuration"]) + 30)

                tab.dispatch_event("click")
                page.wait_for_function(
                    """({key}) => document.querySelector('[data-category-menu="' + key + '"]')
                      ?.getAttribute("aria-expanded") === "false" """,
                    arg={"key": key},
                    timeout=5000,
                )
                closing = panel.evaluate(
                    """el => ({
                      running: el.getAnimations().filter(a => a.playState === "running").map(a => {
                        const timing = a.effect.getTiming();
                        const frames = a.effect.getKeyframes();
                        return {duration: timing.duration, easing: timing.easing, frames};
                      }),
                      hidden: el.hidden,
                      ariaHidden: el.getAttribute("aria-hidden"),
                      inert: el.inert
                    })"""
                )
                if reduced_motion:
                    if not closing["hidden"] or closing["running"]:
                        fail(f"movies/DUFS/{scenario}: {key} did not close immediately under reduced motion")
                else:
                    if closing["hidden"] or closing["ariaHidden"] != "true" or not closing["inert"]:
                        fail(f"movies/DUFS/{scenario}: {key} did not remain visible-but-inert during its exit animation")
                    if not closing["running"]:
                        fail(f"movies/DUFS/{scenario}: {key} did not use the DUME closing animation")
                    for timing in closing["running"]:
                        heights = [float(frame.get("height", "0px").replace("px", "")) for frame in timing["frames"]]
                        if len(heights) < 2 or heights[0] <= 0 or heights[-1] > 1:
                            fail(f"movies/DUFS/{scenario}: {key} closing did not collapse the actual list area back to 0px")
                        if float(timing["duration"]) != 700:
                            fail(f"movies/DUFS/{scenario}: {key} closing does not match the Movies-page 700ms DUME extended-area motion")
                        if abs(float(timing["duration"]) - float(config["dropdownDuration"])) > 1:
                            fail(f"movies/DUFS/{scenario}: {key} closing duration differs from opening/DUME token")
                        if [float(x) for x in re.findall(r"[-+]?(?:\d*\.)?\d+", timing["easing"])] != [float(x) for x in re.findall(r"[-+]?(?:\d*\.)?\d+", config["dropdownEasing"])] :
                            fail(f"movies/DUFS/{scenario}: {key} closing easing differs from opening/DUME token")

                page.wait_for_function(
                    "key => document.querySelector('#dufnFolderPanel-' + key)?.hidden === true",
                    arg=key,
                    timeout=3000,
                )
                if tab.get_attribute("aria-expanded") != "false":
                    fail(f"movies/DUFS/{scenario}: {key} ARIA expanded state remained open after closing")

            # A longer label must grow the intrinsic list width without escaping the viewport.
            all_tab_probe = page.locator('[data-category-menu="all-movies"]')
            all_panel_probe = page.locator("#dufnFolderPanel-all-movies")
            all_tab_probe.dispatch_event("click")
            page.wait_for_function("() => !document.querySelector('#dufnFolderPanel-all-movies').hidden")
            base_width = all_panel_probe.evaluate("(el) => el.getBoundingClientRect().width")
            all_tab_probe.dispatch_event("click")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-all-movies').hidden")
            page.locator("#dufnFolderPanel-all-movies .dufn-folder-grid").evaluate(
                """grid => {
                  const item = document.createElement("button");
                  item.type = "button";
                  item.className = "dumc-nav-item dufn-folder";
                  item.dataset.folderId = "TEST_FUTURE_LONG_LABEL";
                  item.dataset.categoryFolder = "TEST_FUTURE_LONG_LABEL";
                  item.dataset.folderLabel = "Future long folder label used to verify adaptive width";
                  item.innerHTML = '<span>Future long folder label used to verify adaptive width</span>';
                  grid.append(item);
                  window.DULM?.refresh?.();
                }"""
            )
            all_tab_probe.dispatch_event("click")
            page.wait_for_function("() => !document.querySelector('#dufnFolderPanel-all-movies').hidden")
            measured_widths = all_panel_probe.evaluate(
                """el => ({
                  width: el.getBoundingClientRect().width,
                  maxWidth: parseFloat(getComputedStyle(el).maxWidth),
                  longest: Math.max(...[...el.querySelectorAll(".dufn-folder span")].map(node => node.scrollWidth)),
                  viewport: innerWidth
                })"""
            )
            if measured_widths["width"] <= base_width + 20:
                fail(f"movies/DUFS/{scenario}: a longer folder label did not expand the dropdown width ({base_width}px -> {measured_widths})")
            if measured_widths["width"] > measured_widths["viewport"] - 20:
                fail(f"movies/DUFS/{scenario}: adaptive dropdown width exceeded the viewport boundary ({measured_widths})")
            all_tab_probe.dispatch_event("click")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-all-movies').hidden")

            # Opening another category closes the prior one with the same transition.
            first = page.locator('[data-category-menu="all-movies"]')
            second = page.locator('[data-category-menu="genre"]')
            first.dispatch_event("click")
            page.wait_for_function(
                "() => document.querySelector('#dufnFolderPanel-all-movies')?.hidden === false"
            )
            second.dispatch_event("click")
            page.wait_for_function(
                "() => document.querySelector('[data-category-menu=genre]')?.getAttribute('aria-expanded') === 'true'"
            )
            if not reduced_motion:
                page.wait_for_function(
                    "() => document.querySelector('#dufnFolderPanel-all-movies')?.hidden === true",
                    timeout=3000,
                )
            if second.get_attribute("aria-expanded") != "true":
                fail(f"movies/DUFS/{scenario}: switching categories did not leave the new dropdown open")
            second.dispatch_event("click")
            page.wait_for_function(
                "() => document.querySelector('#dufnFolderPanel-genre')?.hidden === true",
                timeout=3000,
            )

            # Repeated category switches must let every previously closing panel finish.
            all_tab = page.locator('[data-category-menu="all-movies"]')
            genre_tab = page.locator('[data-category-menu="genre"]')
            country_tab = page.locator('[data-category-menu="country"]')
            all_tab.dispatch_event("click")
            genre_tab.dispatch_event("click")
            country_tab.dispatch_event("click")
            page.wait_for_function("() => document.querySelector('[data-category-menu=country]')?.getAttribute('aria-expanded') === 'true'")
            if not reduced_motion:
                for old_key in ("all-movies", "genre"):
                    try:
                        page.wait_for_function(
                            f"() => document.querySelector('#dufnFolderPanel-{old_key}')?.hidden === true",
                            timeout=float(config["dropdownDuration"]) + 1500,
                        )
                    except Exception as error:
                        fail(f"movies/DUFS/{scenario}: {old_key} exit animation did not complete after rapid category switching ({error})")
            else:
                for old_key in ("all-movies", "genre"):
                    if not page.locator("#dufnFolderPanel-" + old_key).evaluate("(el) => el.hidden"):
                        fail(f"movies/DUFS/{scenario}: {old_key} did not close immediately under reduced motion")
            if country_tab.get_attribute("aria-expanded") != "true" or page.locator("#dufnFolderPanel-country").evaluate("(el) => el.hidden"):
                fail(f"movies/DUFS/{scenario}: the final category did not stay open after rapid switching")
            country_tab.dispatch_event("click")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-country').hidden")

            # ArrowDown focuses the first folder in the selected category; Escape closes it.
            keyboard_tab = page.locator('[data-category-menu="collections"]')
            keyboard_tab.focus()
            page.keyboard.press("ArrowDown")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-collections')?.hidden === false")
            if not page.locator("#dufnFolderPanel-collections .dufn-folder").first.evaluate("(el) => el === document.activeElement"):
                fail(f"movies/DUFS/{scenario}: ArrowDown did not focus the selected category's first folder")
            page.keyboard.press("Escape")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-collections').hidden")

            # Rapid open-close-open must cancel stale close completion callbacks.
            rapid = page.locator('[data-category-menu="country"]')
            rapid.dispatch_event("click")
            rapid.dispatch_event("click")
            rapid.dispatch_event("click")
            page.wait_for_function(
                "() => document.querySelector('[data-category-menu=country]')?.getAttribute('aria-expanded') === 'true' && !document.querySelector('#dufnFolderPanel-country').hidden"
            )
            if not reduced_motion:
                page.wait_for_timeout(float(config["dropdownDuration"]) + 40)
            if rapid.get_attribute("aria-expanded") != "true" or page.locator("#dufnFolderPanel-country").evaluate("(el) => el.hidden"):
                fail(f"movies/DUFS/{scenario}: stale close animation hid a rapidly reopened dropdown")
            rapid.dispatch_event("click")
            page.wait_for_function(
                "() => document.querySelector('#dufnFolderPanel-country')?.hidden === true",
                timeout=3000,
            )

            # Explicit close, outside click and Escape all use the shared DUME exit.
            close_tab = page.locator('[data-category-menu="subtitles"]')
            close_tab.dispatch_event("click")
            page.wait_for_function("() => !document.querySelector('#dufnFolderPanel-subtitles').hidden")
            page.locator('#dufnFolderPanel-subtitles [data-close-menu]').dispatch_event("click")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-subtitles').hidden")

            close_tab.dispatch_event("click")
            page.wait_for_function("() => !document.querySelector('#dufnFolderPanel-subtitles').hidden")
            page.evaluate("() => document.body.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-subtitles').hidden")

            close_tab.dispatch_event("click")
            page.wait_for_function("() => !document.querySelector('#dufnFolderPanel-subtitles').hidden")
            page.keyboard.press("Escape")
            page.wait_for_function("() => document.querySelector('#dufnFolderPanel-subtitles').hidden")
        except Exception as exc:
            fail(f"movies/DUFS/{scenario}: dropdown lifecycle failed: {type(exc).__name__}: {exc}")
        finally:
            context.close()



def main() -> int:
    server, base_url = serve()
    checks = 0
    try:
        with sync_playwright() as playwright:
            inspect_live_overlay_lifecycle_source()
            browser = playwright.chromium.launch(headless=True)
            inspect_live_overlay_interactions(browser, base_url)
            inspect_dufs_dropdown_lifecycle(browser, base_url)
            checks += 2
            for name, config in PAGES.items():
                route = config[0]
                for viewport_name, width, height in VIEWPORTS:
                    inspect_page(browser, base_url, name, route, viewport_name, width, height)
                    checks += 1
            for name, config in PAGES.items():
                if config[4]:
                    inspect_drawer(browser, base_url, name, config, reduced_motion=False)
                    inspect_drawer(browser, base_url, name, config, reduced_motion=True)
                    inspect_breakpoint(browser, base_url, name, config)
                    inspect_resize_transition(browser, base_url, name, config)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    if WARNINGS:
        print(f"WARNINGS: {len(WARNINGS)} responsive touch-target observations")
        for item in WARNINGS:
            print(f"  - {item}")
    if STACKING_CONTEXT_AUDIT:
        print(f"STACKING-CONTEXT INVENTORY: {len(STACKING_CONTEXT_AUDIT)} ancestor/reason combinations across visible fixed/sticky elements (diagnostic only; no automatic failure)")
        for key, record in sorted(STACKING_CONTEXT_AUDIT.items()):
            print(f"  - {key}: {record['count']} observations; samples={record['samples']}")
    else:
        print("STACKING-CONTEXT INVENTORY: no stacking-context ancestors found for visible fixed/sticky elements in sampled states")
    if FAILURES:
        print(f"FAIL: {len(FAILURES)} browser validation issue(s)")
        for item in FAILURES:
            print(f"  - {item}")
        return 1

    print(
        f"PASS: {checks - 1} page/viewport checks across {len(PAGES)} pages plus 1 dynamic Live Users overlay interaction suite and 1 DUFS dropdown lifecycle suite; "
        "DUCS contrast samples; DUSS/DUPS/DUCS token loading; keyboard focus; "
        "DUME normal/reduced-motion drawer lifecycle, rapid-toggle recovery, 760/761px breakpoint, mobile-to-desktop resize cleanup, Live Users shared-overlay state guards and dynamic drawer/modal/native-dialog lifecycle, close-animation scroll-lock retention, restriction-to-drawer hand-off, fixed-overlay containing-block ancestry, and DUFS click-toggle, symmetric open/close animation, rapid-toggle cancellation, outside-click/Escape, seven-category consistency and reduced-motion behavior."
    )
    print(
        "LIMITATION: 720px is a 200%-zoom layout-width proxy, not native browser zoom. "
        "Static Pages rendering only; no Pages Functions, D1, auth, edge, or production checks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
