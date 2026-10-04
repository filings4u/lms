(function () {
  "use strict";

  const BREAKPOINT = 980;
  const header = document.getElementById("trainingSiteHeader");
  if (!header) return;

  let toggle = null;
  let backdrop = null;
  let initialized = false;

  function findNavigation() {
    return header.querySelector(
      "[data-training-nav-links], .training-nav-links, .training-site-nav-links, .site-nav-links, .nav-links, .training-nav, nav"
    );
  }

  function findEnrollButton() {
    const candidates = Array.from(
      header.querySelectorAll("a, button")
    );

    return candidates.find(function (element) {
      const text = String(element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      return text === "enroll now";
    }) || null;
  }

  function placeMobileHeaderActions() {
    if (!toggle) return;

    const inner = header.querySelector(
      ".training-nav-inner, .training-site-nav-inner, .training-header-inner, .nav-inner, .container"
    ) || header;

    let actions = header.querySelector(".training-mobile-actions");

    if (!actions) {
      actions = document.createElement("div");
      actions.className = "training-mobile-actions";
      inner.appendChild(actions);
    }

    const enroll = findEnrollButton();

    if (enroll) {
      enroll.classList.add("training-mobile-enroll");
      actions.appendChild(enroll);
    }

    actions.appendChild(toggle);
  }

  function closeMenu() {
    header.classList.remove("training-mobile-open");
    document.body.classList.remove("training-nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open training navigation");
    }
  }

  function openMenu() {
    header.classList.add("training-mobile-open");
    document.body.classList.add("training-nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close training navigation");
    }
  }

  function ensureBackdrop() {
    backdrop = document.querySelector(".training-mobile-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "training-mobile-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);
    }
    backdrop.addEventListener("click", closeMenu);
  }

  function init() {
    if (initialized) return;

    const nav = findNavigation();
    if (!nav) return;

    initialized = true;

    if (!nav.id) nav.id = "training-mobile-navigation";

    toggle = header.querySelector(
      "[data-training-mobile-toggle], .training-mobile-toggle, .mobile-nav-toggle, .menu-toggle"
    );

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "training-mobile-toggle";
      toggle.setAttribute("data-training-mobile-toggle", "");
      toggle.innerHTML = '<span aria-hidden="true"></span>';

      const inner = header.querySelector(
        ".training-nav-inner, .training-site-nav-inner, .training-header-inner, .nav-inner, .container"
      );
      (inner || header).appendChild(toggle);
    }

    placeMobileHeaderActions();

    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open training navigation");

    toggle.addEventListener("click", function (event) {
      if (window.innerWidth > BREAKPOINT) return;
      event.preventDefault();
      event.stopPropagation();
      if (header.classList.contains("training-mobile-open")) closeMenu();
      else openMenu();
    });

    nav.addEventListener("click", function (event) {
      const link = event.target.closest("a");
      if (link && window.innerWidth <= BREAKPOINT) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (
        window.innerWidth <= BREAKPOINT &&
        header.classList.contains("training-mobile-open") &&
        !header.contains(event.target)
      ) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > BREAKPOINT) closeMenu();
      placeMobileHeaderActions();
    });

    ensureBackdrop();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  /* training-site-nav.js injects the header. If it runs after this file,
     initialize once its markup arrives. */
  const observer = new MutationObserver(function () {
    if (!initialized && findNavigation()) init();
    if (initialized) observer.disconnect();
  });
  observer.observe(header, { childList: true, subtree: true });
})();
