// Screenings4u Learning Center — Documents 2026 UI
(() => {
  "use strict";
  const body = document.body;
  if (!body) return;
  body.classList.add("s4u-2026-page", "s4u-2026-lms-documents");

  // Create the branded hero from the page's existing heading without changing functional hooks.
  const candidates = [
    document.querySelector(".lms-page-heading"),
    document.querySelector(".lms-support-intro"),
    document.querySelector(".page-header"),
    document.querySelector("main .lms-content h1")?.parentElement
  ].filter(Boolean);

  const heading = candidates[0];
  if (heading && !document.querySelector(".s4u-page-hero")) {
    const h1 = heading.querySelector("h1") || (heading.tagName === "H1" ? heading : null);
    if (h1) {
      const existingP = heading.querySelector("p");
      const hero = document.createElement("section");
      hero.className = "s4u-page-hero";
      const inner = document.createElement("div");
      inner.className = "s4u-page-hero-inner";
      const kicker = document.createElement("span");
      kicker.className = "s4u-page-kicker";
      kicker.textContent = "SCREENINGS4U LEARNING CENTER";
      inner.appendChild(kicker);
      inner.appendChild(h1);
      if (existingP) inner.appendChild(existingP);
      hero.appendChild(inner);
      heading.replaceWith(hero);
    }
  }
})();
