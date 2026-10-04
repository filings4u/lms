// Screenings4u Learning Center — page-specific UI enhancements
(() => {
  "use strict";
  document.documentElement.dataset.pageRedesign = "2026";
  const body = document.body;
  if (!body) return;
  body.classList.add("page-redesign", "page-redesign-lms-my-courses");
  const heading = document.querySelector(".lms-page-heading, .lms-support-intro, main h1, .lms-content h1");
  if (heading && !heading.querySelector(".page-redesign-accent")) {
    const accent = document.createElement("div");
    accent.className = "page-redesign-accent";
    accent.setAttribute("aria-hidden", "true");
    heading.appendChild(accent);
  }
})();
