/* Shared navigation and account shell for every DRM Premium page. */
(() => {
  "use strict";

  const q = (selector, root = document) => root.querySelector(selector);
  const header = () => q("header");
  const menuIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h17M3.5 12h17M3.5 18h17"/></svg>';

  function ensureSidebar() {
    if (q(".yt-sidebar")) return;
    const host = header();
    if (!host) return;

    let trigger = q(".yt-menu-trigger", host);
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "site-shell-menu-toggle yt-menu-trigger";
      trigger.setAttribute("aria-label", "মেনু খুলুন");
      trigger.innerHTML = menuIcon;
      host.prepend(trigger);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "site-shell-backdrop";
    backdrop.hidden = true;

    const sidebar = document.createElement("aside");
    sidebar.className = "site-shell-sidebar yt-sidebar";
    sidebar.setAttribute("aria-label", "প্রধান মেনু");
    sidebar.innerHTML = `
      <div class="sidebar-primary">
        <a class="side-link" href="/"><span class="side-icon">⌂</span><span>Home</span></a>
        <a class="side-link" href="/movies.html"><span class="side-icon">▣</span><span>Movies</span></a>
        <a class="side-link" href="/#browse"><span class="side-icon">▶</span><span>Videos</span></a>
        <a class="side-link" href="/#references"><span class="side-icon">▤</span><span>References</span></a>
        <a class="side-link" href="/#articles"><span class="side-icon">▧</span><span>Articles</span></a>
        <a class="side-link" href="/#books"><span class="side-icon">▣</span><span>Books</span></a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">You</div>
        <a class="side-link" href="/admin"><span class="side-icon">◉</span><span>Admin dashboard</span></a>
        <a class="side-link" href="/#about"><span class="side-icon">ⓘ</span><span>About</span></a>
      </div>`;
    document.body.append(backdrop, sidebar);

    let closeTimer = null;
    const setOpen = open => {
      clearTimeout(closeTimer);
      if (open) {
        backdrop.hidden = false;
        void sidebar.offsetWidth;
        document.body.classList.add("site-shell-menu-open", "sidebar-open");
      } else {
        document.body.classList.remove("site-shell-menu-open", "sidebar-open");
        closeTimer = window.setTimeout(() => { backdrop.hidden = true; }, 700);
      }
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-label", open ? "মেনু বন্ধ করুন" : "মেনু খুলুন");
    };

    trigger.addEventListener("click", () => setOpen(!document.body.classList.contains("site-shell-menu-open")));
    backdrop.addEventListener("click", () => setOpen(false));
    sidebar.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", event => { if (event.key === "Escape") setOpen(false); });
  }

  function fillAvatar(container, imageUrl, initial) {
    if (!container) return;
    container.textContent = initial;
    if (!imageUrl) return;

    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.src = imageUrl;
    image.addEventListener("error", () => {
      image.remove();
      container.textContent = initial;
    }, { once: true });
    container.textContent = "";
    container.append(image);
  }

  function createProfile() {
    if (q("#profileMenuToggle") || q("#profileDrawer")) return;
    const host = header();
    if (!host) return;

    const toggle = document.createElement("button");
    toggle.id = "profileMenuToggle";
    toggle.type = "button";
    toggle.className = "site-shell-profile-toggle";
    toggle.hidden = true;
    toggle.setAttribute("aria-label", "প্রোফাইল মেনু খুলুন");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "profileDrawer");
    (q(".account-controls", host) || host).append(toggle);

    const drawer = document.createElement("aside");
    drawer.id = "profileDrawer";
    drawer.className = "site-shell-profile-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="site-shell-profile-drawer__head"><span>YOUR ACCOUNT</span><button type="button" class="site-shell-profile-drawer__close" aria-label="Close">×</button></div>
      <div class="site-shell-profile-drawer__identity"><div class="site-shell-profile-drawer__avatar">U</div><div><div class="site-shell-profile-drawer__name">Profile</div><div class="site-shell-profile-drawer__user"></div></div></div>
      <a class="site-shell-profile-drawer__profile" href="/profile.html"><span>View Profile</span><span aria-hidden="true">→</span></a>
      <div class="site-shell-profile-drawer__details">
        <div class="site-shell-profile-drawer__detail site-shell-profile-drawer__detail--full"><span class="site-shell-profile-drawer__label">ABOUT</span><span class="site-shell-profile-drawer__value" data-field="bio">Not added yet</span></div>
        <div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">DATE OF BIRTH</span><span class="site-shell-profile-drawer__value" data-field="dob">Not added</span></div>
        <div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">GENDER</span><span class="site-shell-profile-drawer__value" data-field="gender">Not specified</span></div>
        <div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">LOCATION</span><span class="site-shell-profile-drawer__value" data-field="location">Not added</span></div>
        <div class="site-shell-profile-drawer__detail site-shell-profile-drawer__detail--full"><span class="site-shell-profile-drawer__label">EMAIL</span><span class="site-shell-profile-drawer__value" data-field="email">—</span></div>
      </div>
      <div class="site-shell-profile-drawer__footer"><p role="status" aria-live="polite"></p><button type="button" class="site-shell-profile-drawer__logout"><span aria-hidden="true">↪</span> Logout</button></div>`;
    document.body.append(drawer);

    const open = state => {
      drawer.classList.toggle("is-open", state);
      drawer.setAttribute("aria-hidden", String(!state));
      toggle.setAttribute("aria-expanded", String(state));
      toggle.setAttribute("aria-label", state ? "প্রোফাইল মেনু বন্ধ করুন" : "প্রোফাইল মেনু খুলুন");
      document.body.classList.toggle("profile-drawer-open", state);
    };
    toggle.addEventListener("click", () => open(!drawer.classList.contains("is-open")));
    q(".site-shell-profile-drawer__close", drawer).addEventListener("click", () => open(false));
    document.addEventListener("keydown", event => { if (event.key === "Escape") open(false); });
    document.addEventListener("pointerdown", event => {
      if (drawer.classList.contains("is-open") && !drawer.contains(event.target) && !toggle.contains(event.target)) open(false);
    }, true);
    q(".site-shell-profile-drawer__logout", drawer).addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = q(".site-shell-profile-drawer__footer p", drawer);
      button.disabled = true;
      if (status) status.textContent = "";
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(result.error || "Logout করা যায়নি। আবার চেষ্টা করুন।");
        const sessionCheck = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const session = await sessionCheck.json().catch(() => ({}));
        if (!sessionCheck.ok || session.authenticated !== false) throw new Error("Logout সম্পন্ন হয়েছে কি না যাচাই করা যায়নি। পেজ Refresh করে আবার চেষ্টা করুন।");
        window.location.reload();
      } catch (error) {
        if (status) status.textContent = error.message || "Logout করা যায়নি। আবার চেষ্টা করুন।";
        button.disabled = false;
      }
    });

    (async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin" });
        const me = await response.json();
        if (!me.authenticated) return;
        const user = me.user || {};
        const profileResponse = await fetch("/api/profile", { credentials: "same-origin" });
        const data = profileResponse.ok ? await profileResponse.json() : {};
        const profile = data.profile || {};
        const initial = (String(profile.full_name || user.username || "U").trim().charAt(0) || "U").toUpperCase();
        const avatarUrl = profile.avatar_url || "";

        fillAvatar(toggle, avatarUrl, initial);
        fillAvatar(q(".site-shell-profile-drawer__avatar", drawer), avatarUrl, initial);
        q(".site-shell-profile-drawer__name", drawer).textContent = profile.full_name || user.username || "Profile";
        q(".site-shell-profile-drawer__user", drawer).textContent = user.username ? "@" + user.username : "";

        const values = {
          bio: profile.bio || "Not added yet",
          dob: profile.date_of_birth || "Not added",
          gender: ({ female: "Female", male: "Male", non_binary: "Non-binary", prefer_not_to_say: "Prefer not to say" })[profile.gender] || "Not specified",
          location: profile.location || "Not added",
          email: user.email || "—"
        };
        Object.entries(values).forEach(([key, value]) => {
          const node = q('[data-field="' + key + '"]', drawer);
          if (node) node.textContent = value;
        });
        toggle.hidden = false;
      } catch (_) {}
    })();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureSidebar();
    createProfile();
  });
})();
