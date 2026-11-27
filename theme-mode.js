/* DRM Premium persistent light/dark theme switch — static-hosting compatible. */
(() => {
  "use strict";
  const KEY = "drm-theme-mode";
  const root = document.documentElement;
  const valid = value => value === "light" || value === "dark";
  let initial = "dark";
  try {
    const stored = localStorage.getItem(KEY);
    if (valid(stored)) initial = stored;
  } catch (_) {}
  root.dataset.theme = initial;
  root.style.colorScheme = initial;

  const sun = '<span class="drm-theme-icon drm-theme-icon-sun" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg></span>';
  const moon = '<span class="drm-theme-icon drm-theme-icon-moon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.2 15.2A8.6 8.6 0 0 1 8.8 3.8 8.8 8.8 0 1 0 20.2 15.2Z"/></svg></span>';

  function setTheme(mode, persist) {
    if (!valid(mode)) return;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    const button = document.querySelector(".drm-theme-switch");
    if (button) {
      const light = mode === "light";
      button.setAttribute("aria-checked", String(light));
      button.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
      button.title = light ? "Switch to dark mode" : "Switch to light mode";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "light" ? "#e6edf3" : "#0f0f0f");
    if (persist) {
      try { localStorage.setItem(KEY, mode); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("drm:themechange", { detail: { theme: mode } }));
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const tab = event.target.closest(".category-tabs>.category-chip,.dufn-tabs .dufn-tab,.live-restrictions-tabs>.live-restriction-tab,.page-tabs>.tab,.type-switch>.type,.device-switch>button");
    if (!tab || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const oldRipple = tab.querySelector(".tab-water-ripple");
    if (oldRipple) oldRipple.remove();
    const rect = tab.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "tab-water-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.setProperty("--ripple-x", ((event.clientX || rect.left + rect.width / 2) - rect.left) + "px");
    ripple.style.setProperty("--ripple-y", ((event.clientY || rect.top + rect.height / 2) - rect.top) + "px");
    tab.append(ripple);
    window.setTimeout(() => ripple.remove(), 760);
  }, { passive: true });

  function mount() {
    if (!document.body || document.querySelector(".drm-theme-switch")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drm-theme-switch";
    button.setAttribute("role", "switch");
    button.innerHTML = sun + moon + '<span class="drm-theme-knob" aria-hidden="true"></span>';
    button.addEventListener("click", () => {
      setTheme(root.dataset.theme === "light" ? "dark" : "light", true);
    });
    document.body.append(button);
    setTheme(root.dataset.theme, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
  window.addEventListener("storage", event => {
    if (event.key === KEY && valid(event.newValue)) setTheme(event.newValue, false);
  });
})();
