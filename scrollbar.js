/* DRM PREMIUM — cross-browser custom vertical page scrollbar.
   Uses native document scrolling; the custom thumb is only a visual/drag control. */
(() => {
  "use strict";

  const init = () => {
    const root = document.documentElement;
    if (!root || document.getElementById("drmPageScrollbar")) return;

    const rail = document.createElement("div");
    rail.id = "drmPageScrollbar";
    rail.setAttribute("aria-hidden", "false");

    const thumb = document.createElement("div");
    thumb.className = "drm-scrollbar-thumb";
    thumb.setAttribute("role", "scrollbar");
    thumb.setAttribute("aria-label", "Page scroll");
    thumb.setAttribute("aria-orientation", "vertical");
    thumb.setAttribute("aria-valuemin", "0");
    thumb.setAttribute("aria-valuemax", "100");
    thumb.setAttribute("aria-valuenow", "0");
    thumb.setAttribute("tabindex", "0");

    rail.appendChild(thumb);
    document.body.appendChild(rail);
    root.classList.add("drm-custom-scrollbar-ready");
    document.body.classList.add("drm-custom-scrollbar-ready");

    let frame = 0;
    let drag = null;
    let metrics = null;
    let lastRange = 0;

    // Expensive document dimensions are measured only after layout changes,
    // never on every scroll event.
    const measure = () => {
      const viewport = window.innerHeight || root.clientHeight;
      const doc = document.scrollingElement || root;
      const total = Math.max(doc.scrollHeight, root.scrollHeight, document.body.scrollHeight);
      const maxScroll = Math.max(0, total - viewport);
      const thumbHeight = maxScroll === 0
        ? viewport
        : Math.min(viewport, Math.max(24, (viewport * viewport) / total));
      const travel = Math.max(0, viewport - thumbHeight);
      metrics = { viewport, maxScroll, thumbHeight, travel };
      lastRange = maxScroll;
      rail.hidden = !(maxScroll > 1 && travel > 0);
      if (!rail.hidden) {
        thumb.style.height = thumbHeight + "px";
      }
      schedule();
    };

    const render = () => {
      frame = 0;
      if (!metrics || rail.hidden) return;
      const doc = document.scrollingElement || root;
      const scrollTop = Math.min(metrics.maxScroll, Math.max(0, window.scrollY || doc.scrollTop || 0));
      const top = metrics.maxScroll ? (scrollTop / metrics.maxScroll) * metrics.travel : 0;
      thumb.style.transform = "translate3d(0," + top + "px,0)";
      rail.classList.add("is-visible");
      thumb.setAttribute("aria-valuenow", String(Math.round((scrollTop / metrics.maxScroll) * 100)));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const scrollFromPointer = (clientY) => {
      const m = metrics;
      if (!m || !m.maxScroll || !m.travel) return;
      const top = Math.min(m.travel, Math.max(0, clientY - drag.grabOffset));
      window.scrollTo({ top: (top / m.travel) * m.maxScroll, behavior: "auto" });
    };

    thumb.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const m = metrics;
      if (!m) return;
      const doc = document.scrollingElement || root;
      const currentScroll = Math.min(m.maxScroll, Math.max(0, window.scrollY || doc.scrollTop || 0));
      const currentTop = m.maxScroll ? (currentScroll / m.maxScroll) * m.travel : 0;
      drag = { pointerId: event.pointerId, startY: event.clientY, startTop: currentTop, grabOffset: event.clientY - currentTop };
      thumb.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    thumb.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      scrollFromPointer(event.clientY);
    });

    const stopDrag = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      drag = null;
    };
    thumb.addEventListener("pointerup", stopDrag);
    thumb.addEventListener("pointercancel", stopDrag);
    thumb.addEventListener("lostpointercapture", stopDrag);

    thumb.addEventListener("keydown", (event) => {
      const current = window.scrollY || (document.scrollingElement || root).scrollTop || 0;
      const page = window.innerHeight * 0.9;
      let next = null;
      switch (event.key) {
        case "ArrowDown": next = current + 40; break;
        case "ArrowUp": next = current - 40; break;
        case "PageDown": next = current + page; break;
        case "PageUp": next = current - page; break;
        case "Home": next = 0; break;
        case "End": next = lastRange; break;
        default: return;
      }
      event.preventDefault();
      window.scrollTo({ top: next, behavior: "auto" });
    });

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("orientationchange", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure, { passive: true });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(measure);
      observer.observe(root);
      if (document.body) observer.observe(document.body);
    }
    if ("MutationObserver" in window) {
      const observer = new MutationObserver(measure);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    measure();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
