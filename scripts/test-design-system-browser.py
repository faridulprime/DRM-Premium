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
from time import sleep

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "homepage": ("/", "#menuToggle", "#ytSidebar", "#sidebarBackdrop", True),
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
              };
            }"""
        )

        if metrics["bodyTextLength"] == 0:
            fail(f"{name}/{viewport_name}: body contains no visible text")
        if metrics["headerHeight"] <= 0:
            fail(f"{name}/{viewport_name}: visible header geometry could not be measured")
        if name != "profile":
            expected_layer = (
                metrics["tokens"]["dupsLiveHeader"]
                if name == "live-users"
                else metrics["tokens"]["dupsHomeHeaderMobile"]
                if name in ("homepage", "upload-studio") and width <= 760
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
        if name == "homepage" and width <= 900:
            builder_inspector = page.evaluate(
                """() => {
                  const element = document.querySelector(".sb-inspector");
                  const root = getComputedStyle(document.documentElement);
                  if (!element) return {missing: true};
                  const style = getComputedStyle(element);
                  return {
                    position: style.position,
                    zIndex: style.zIndex,
                    token: root.getPropertyValue("--dups-layer-builder-inspector").trim()
                  };
                }"""
            )
            if builder_inspector.get("missing"):
                fail(f"{name}/{viewport_name}: Builder inspector element is missing")
            else:
                try:
                    if builder_inspector["position"] != "absolute":
                        fail(f"{name}/{viewport_name}: responsive Builder inspector is not absolutely positioned ({builder_inspector})")
                    if float(builder_inspector["zIndex"]) != float(builder_inspector["token"]):
                        fail(f"{name}/{viewport_name}: Builder inspector z-index does not match its DUPS token ({builder_inspector})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: Builder inspector DUPS layer could not be resolved ({builder_inspector})")

        if name == "homepage":
            homepage_layers = page.evaluate(
                """() => {
                  const root = getComputedStyle(document.documentElement);
                  const contracts = [
                    ["site-builder", "#siteBuilder", "--dups-layer-site-builder"],
                    ["suspension-screen", "#accountSuspensionScreen", "--dups-layer-suspension-screen"],
                    ["profile-bar-backdrop", "#profileBarBackdrop", "--dups-layer-profile-complete-backdrop"],
                    ["profile-complete-bar", "#profileCompleteBar", "--dups-layer-profile-complete-bar"]
                  ];
                  return contracts.map(([name, selector, token]) => {
                    const element = document.querySelector(selector);
                    if (!element) return {name, missing: true};
                    const style = getComputedStyle(element);
                    return {
                      name,
                      position: style.position,
                      zIndex: style.zIndex,
                      token: root.getPropertyValue(token).trim()
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
                    if float(layer["zIndex"]) != float(layer["token"]):
                        fail(f"{name}/{viewport_name}: {layer['name']} z-index does not match its DUPS token ({layer})")
                except (TypeError, ValueError, KeyError):
                    fail(f"{name}/{viewport_name}: {layer['name']} DUPS layer could not be resolved ({layer})")
            try:
                layers_by_name = {layer["name"]: float(layer["zIndex"]) for layer in homepage_layers if not layer.get("missing")}
                if layers_by_name.get("profile-complete-bar", 0) <= layers_by_name.get("profile-bar-backdrop", 0):
                    fail(f"{name}/{viewport_name}: profile completion bar must stack above its backdrop ({layers_by_name})")
            except (TypeError, ValueError, KeyError):
                fail(f"{name}/{viewport_name}: profile completion overlay stack could not be compared ({homepage_layers})")

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
        expected_sidebar = layers["tokens"]["homeSidebar"] if name == "homepage" else layers["tokens"]["sidebar"]
        expected_backdrop = layers["tokens"]["homeBackdrop"] if name == "homepage" else layers["tokens"]["backdrop"]
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
                if name in ("homepage", "admin")
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

def main() -> int:
    server, base_url = serve()
    checks = 0
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
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
    if FAILURES:
        print(f"FAIL: {len(FAILURES)} browser validation issue(s)")
        for item in FAILURES:
            print(f"  - {item}")
        return 1

    print(
        f"PASS: {checks} page/viewport checks across {len(PAGES)} pages; "
        "DUCS contrast samples; DUSS/DUPS/DUCS token loading; keyboard focus; "
        "DUME normal/reduced-motion drawer lifecycle, rapid-toggle recovery, 760/761px breakpoint, and mobile-to-desktop resize cleanup."
    )
    print(
        "LIMITATION: 720px is a 200%-zoom layout-width proxy, not native browser zoom. "
        "Static Pages rendering only; no Pages Functions, D1, auth, edge, or production checks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
