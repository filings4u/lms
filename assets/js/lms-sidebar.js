/* ============================================================
   SCREENINGS4U LEARNING CENTER
   DYNAMIC LMS SIDEBAR
   Mimics the Customer Portal sidebar shell behavior while
   preserving Learning Center navigation and LMS class names.
   ============================================================ */

(function () {
  "use strict";

  const DESKTOP_BREAKPOINT = 860;

  // This navigation file may be loaded normally or injected by the portal shell.
  // If DOMContentLoaded has already fired, waiting for it again leaves the
  // mobile toggle unbound. Initialize immediately in that case.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeLmsSidebar, {
      once: true
    });
  } else {
    initializeLmsSidebar();
  }

  /* ============================================================
     INITIALIZE
     ============================================================ */

  function initializeLmsSidebar() {
    if (document.documentElement.dataset.lmsNavigationInitialized === "true") {
      return;
    }

    document.documentElement.dataset.lmsNavigationInitialized = "true";

    injectLmsSidebar();
    injectMobileStyles();
    setActiveNavigation();
    initializeDesktopAccordion();
    initializeMobileNavigation();
    initializeUserMenu();
    initializeShellEnhancements();
    injectShellPageContext();
    window.dispatchEvent(new CustomEvent("lms:sidebar-ready"));
  }


  /* ============================================================
     SIDEBAR
     ============================================================ */

  function injectLmsSidebar() {
    const sidebarTarget = document.getElementById(
      "lms-sidebar-target"
    );

    if (!sidebarTarget) {
      return;
    }

    sidebarTarget.innerHTML = getSidebarMarkup();
  }


  /* ============================================================
     SIDEBAR MARKUP
     ============================================================ */

  function getSidebarMarkup() {
    return `
      <aside
        class="lms-sidebar"
        id="lms-sidebar"
        aria-label="Learning navigation"
      >
        <div class="lms-sidebar-inner">

          <!-- =================================================
               BRAND
               ================================================= -->

          <div class="lms-sidebar-brand">

            <a
              href="lms-dashboard.html"
              class="lms-brand"
              aria-label="Screenings4u Learning Center"
            >
              <img
                src="images/training-logo.png"
                alt="screenings4u Learning Center"
                class="lms-brand-logo"
              />

              <div class="lms-brand-copy">
                <span class="lms-brand-subtitle">
                  Learning Center
                </span>
              </div>
            </a>
          </div>


          <!-- =================================================
               NAVIGATION
               ================================================= -->

          <div class="lms-sidebar-scroll">


            <!-- LEARNING -->

            <div class="lms-nav-group">

              <button type="button" class="lms-nav-label" aria-expanded="false">
                <span>Learning</span>
              </button>

              <nav class="lms-nav">

                      <!-- WELCOME & POLICIES -->

                <a
                  href="lms-welcome.html"
                  class="lms-nav-link"
                  data-lms-page="lms-welcome.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                      <path d="M8 9h8M8 13h8M8 17h5"></path>
                    </svg>
                  </span>
                  <span class="lms-nav-text">Welcome &amp; Policies</span>
                </a>

                <!-- HOME -->

                <a
                  href="lms-dashboard.html"
                  class="lms-nav-link"
                  data-lms-page="lms-dashboard.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 10.5 12 3l9 7.5"></path>
                      <path d="M5 9.5V21h14V9.5"></path>
                      <path d="M9 21v-6h6v6"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    Home
                  </span>
                </a>


                <!-- MY LEARNING -->

                <a
                  href="lms-my-courses.html"
                  class="lms-nav-link"
                  data-lms-page="lms-my-courses.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="16"
                        rx="2"
                      ></rect>
                      <path d="M7 8h10"></path>
                      <path d="M7 12h7"></path>
                      <path d="M7 16h5"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    My Learning
                  </span>
                </a>


                <!-- COURSE LIBRARY -->

                <a
                  href="lms-courses.html"
                  class="lms-nav-link"
                  data-lms-page="lms-courses.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path>
                      <path d="M4 5.5v16"></path>
                      <path d="M8 7h8"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    Course Library
                  </span>
                </a>

              </nav>

            </div>


            <!-- TRACK -->

            <div class="lms-nav-group">

              <button type="button" class="lms-nav-label" aria-expanded="false">
                <span>Track</span>
              </button>

              <nav class="lms-nav">

                <!-- PROGRESS -->

                <a
                  href="lms-progress.html"
                  class="lms-nav-link"
                  data-lms-page="lms-progress.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 19V9"></path>
                      <path d="M10 19V5"></path>
                      <path d="M16 19v-7"></path>
                      <path d="M22 19V3"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    Progress
                  </span>
                </a>


                <!-- CERTIFICATES -->

                <a
                  href="lms-certificates.html"
                  class="lms-nav-link"
                  data-lms-page="lms-certificates.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="8"
                        r="5"
                      ></circle>
                      <path d="m8.5 12.5-1 8L12 18l4.5 2.5-1-8"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    Certificates
                  </span>
                </a>

              </nav>

            </div>


            <!-- APPOINTMENTS -->

            <div class="lms-nav-group">

              <button type="button" class="lms-nav-label" aria-expanded="false">
                <span>Appointments</span>
              </button>

              <nav class="lms-nav">

                <a href="lms-schedule-appointment.html" class="lms-nav-link" data-lms-page="lms-schedule-appointment.html">
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"></path></svg>
                  </span>
                  <span class="lms-nav-text">Schedule Appointment</span>
                </a>

                <a href="lms-my-appointments.html" class="lms-nav-link" data-lms-page="lms-my-appointments.html">
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18M8 15l2.5 2.5L16 12"></path></svg>
                  </span>
                  <span class="lms-nav-text">My Appointments</span>
                </a>

                <a href="lms-reschedule-appointment.html" class="lms-nav-link" data-lms-page="lms-reschedule-appointment.html">
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path><path d="M8 15a4 4 0 1 0 1-2.7"></path><path d="M8 11v4h4"></path></svg>
                  </span>
                  <span class="lms-nav-text">Reschedule Appointment</span>
                </a>

                <a href="lms-live-training.html" class="lms-nav-link" data-lms-page="lms-live-training.html">
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="m10 9 5 3-5 3V9z"></path></svg>
                  </span>
                  <span class="lms-nav-text">Live Training</span>
                </a>

              </nav>

            </div>


            <!-- ACCOUNT -->

            <div class="lms-nav-group">

              <button type="button" class="lms-nav-label" aria-expanded="false">
                <span>Account</span>
              </button>

              <nav class="lms-nav">

                <!-- ORDERS -->

                <a
                  href="lms-orders.html"
                  class="lms-nav-link"
                  data-lms-page="lms-orders.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"></path>
                      <path d="M9 8h6M9 12h6"></path>
                    </svg>
                  </span>
                  <span class="lms-nav-text">Orders</span>
                </a>


                <!-- DOCUMENTS -->

                <a
                  href="lms-documents.html"
                  class="lms-nav-link"
                  data-lms-page="lms-documents.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 3h8l4 4v14H6z"></path>
                      <path d="M14 3v5h5"></path>
                      <path d="M9 13h6M9 17h6"></path>
                    </svg>
                  </span>
                  <span class="lms-nav-text">Documents</span>
                </a>


                <!-- MY ACCOUNT -->

                <a
                  href="lms-account.html"
                  class="lms-nav-link"
                  data-lms-page="lms-account.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                      ></circle>
                      <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    My Account
                  </span>
                </a>


                <!-- TRAINING SUPPORT -->

                <a
                  href="lms-support.html"
                  class="lms-nav-link"
                  data-lms-page="lms-support.html"
                >
                  <span class="lms-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9"></circle>
                      <path d="M9.5 9a2.7 2.7 0 0 1 5.2 1c0 2-2.7 2.3-2.7 4"></path>
                      <path d="M12 18h.01"></path>
                    </svg>
                  </span>

                  <span class="lms-nav-text">
                    Support
                  </span>
                </a>

              </nav>

            </div>

          </div>


          <!-- =================================================
               SIDEBAR FOOTER
               ================================================= -->

          <div class="lms-sidebar-footer">

            <div class="lms-sidebar-footer-links">

              <!-- BACK TO MAIN WEBSITE -->

              <a
                href="https://training.screenings4u.com"
                class="lms-return-link"
              >
                <span class="lms-nav-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 12H5"></path>
                    <path d="m12 19-7-7 7-7"></path>
                  </svg>
                </span>

                <span class="lms-return-text">
                  Back to Screenings4u
                </span>
              </a>
            </div>

          </div>

        </div>
      </aside>


      <!-- MOBILE OVERLAY -->

      <div
        class="lms-sidebar-overlay"
        id="lms-sidebar-overlay"
        data-lms-sidebar-overlay
        aria-hidden="true"
      ></div>
    `;
  }




  /* ============================================================
     PAGE + DESKTOP ACCORDION
     ============================================================ */

  function currentPageName() {
    let page = window.location.pathname.split("/").pop() || "lms-dashboard.html";
    page = page.split("?")[0].split("#")[0];

    if (page === "lms-customer-scheduling.html") {
      page = "lms-schedule-appointment.html";
    }

    return page;
  }

  function initializeDesktopAccordion() {
    const sidebar = document.getElementById("lms-sidebar");
    if (!sidebar) return;

    const groups = Array.from(sidebar.querySelectorAll(".lms-nav-group"));
    if (!groups.length) return;

    function setGroupState(group, open) {
      group.classList.toggle("is-open", open);
      const button = group.querySelector(".lms-nav-label");
      if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function openOnly(target) {
      groups.forEach(function (group) {
        setGroupState(group, group === target);
      });
    }

    groups.forEach(function (group) {
      const button = group.querySelector(".lms-nav-label");
      if (!button) return;

      button.addEventListener("click", function () {
        if (window.innerWidth <= 1100) return;
        const willOpen = !group.classList.contains("is-open");
        groups.forEach(function (item) {
          setGroupState(item, willOpen && item === group);
        });
      });
    });

    const activeLink = sidebar.querySelector(".lms-nav-link.active");
    const activeGroup = activeLink ? activeLink.closest(".lms-nav-group") : null;

    if (window.innerWidth <= 1100) {
      groups.forEach(function (group) { setGroupState(group, true); });
    } else {
      openOnly(activeGroup || groups[0]);
    }

    window.addEventListener("resize", function () {
      if (window.innerWidth <= 1100) {
        groups.forEach(function (group) { setGroupState(group, true); });
      } else {
        const currentOpen = groups.find(function (group) { return group.classList.contains("is-open"); });
        openOnly(activeGroup || currentOpen || groups[0]);
      }
    });
  }


  /* ============================================================
     ACTIVE NAVIGATION
     ============================================================ */

  function setActiveNavigation() {
    const current = currentPageName();

    document
      .querySelectorAll("[data-lms-page]")
      .forEach(function (link) {
        const page =
          String(link.dataset.lmsPage || "")
            .split("?")[0]
            .split("#")[0];

        const isActive = page === current;

        link.classList.toggle("active", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

  }

  /* ============================================================
     MOBILE DROPDOWN NAVIGATION
     ============================================================ */

  function injectMobileDropdownNavigation() {
    if (
      document.getElementById(
        "lms-mobile-dropdown"
      )
    ) {
      return;
    }

    if (!document.body) {
      return;
    }

    const backdrop =
      document.createElement("div");

    backdrop.id =
      "lms-mobile-dropdown-backdrop";

    backdrop.className =
      "lms-mobile-dropdown-backdrop";

    backdrop.hidden = true;


    const dropdown =
      document.createElement("div");

    dropdown.id =
      "lms-mobile-dropdown";

    dropdown.className =
      "lms-mobile-dropdown";

    dropdown.hidden = true;

    dropdown.setAttribute(
      "role",
      "navigation"
    );

    dropdown.setAttribute(
      "aria-label",
      "Learning Center navigation"
    );


    document.body.append(
      backdrop,
      dropdown
    );

    injectMobileStyles();
  }


  function rebuildMobileDropdown() {
    const sidebar =
      document.getElementById(
        "lms-sidebar"
      );

    const dropdown =
      document.getElementById(
        "lms-mobile-dropdown"
      );

    if (!sidebar || !dropdown) {
      return;
    }

    dropdown.innerHTML = "";

    const groups =
      sidebar.querySelectorAll(
        ".lms-nav-group"
      );

    groups.forEach(function (group) {
      const links =
        group.querySelectorAll(
          ".lms-nav-link"
        );

      if (!links.length) {
        return;
      }

      const section =
        document.createElement("section");

      section.className =
        "lms-mobile-dropdown-section";

      const sourceLabel =
        group.querySelector(
          ".lms-nav-label"
        );

      if (sourceLabel) {
        const heading =
          document.createElement("div");

        heading.className =
          "lms-mobile-dropdown-label";

        heading.textContent =
          sourceLabel.textContent.trim();

        section.appendChild(heading);
      }

      links.forEach(function (sourceLink) {
        const link =
          document.createElement("a");

        link.href =
          sourceLink.getAttribute("href") || "#";

        link.className =
          "lms-mobile-dropdown-link";

        const text =
          sourceLink.querySelector(
            ".lms-nav-text"
          );

        link.textContent =
          text
            ? text.textContent.trim()
            : sourceLink.textContent
                .replace(/\s+/g, " ")
                .trim();

        if (
          sourceLink.classList.contains(
            "active"
          )
        ) {
          link.classList.add("active");

          link.setAttribute(
            "aria-current",
            "page"
          );
        }

        section.appendChild(link);
      });

      dropdown.appendChild(section);
    });


    const footer =
      sidebar.querySelector(
        ".lms-sidebar-footer"
      );

    const returnLink =
      footer
        ? footer.querySelector(
            ".lms-return-link"
          )
        : null;

    if (returnLink) {
      const section =
        document.createElement("section");

      section.className =
        "lms-mobile-dropdown-section lms-mobile-dropdown-return";

      const link =
        document.createElement("a");

      link.href =
        returnLink.getAttribute("href") || "#";

      link.className =
        "lms-mobile-dropdown-link";

      const text =
        returnLink.querySelector(
          ".lms-return-text"
        );

      link.textContent =
        text
          ? text.textContent.trim()
          : "Back to Screenings4u";

      section.appendChild(link);
      dropdown.appendChild(section);
    }
  }


  function injectMobileStyles() {
    if (document.getElementById("lms-mobile-responsive-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "lms-mobile-responsive-styles";
    style.textContent = `
      /* ========================================================
         Shared Learning Center shell fixes
         ======================================================== */
      .lms-user-menu-link:hover,
      .lms-user-menu-link:focus-visible {
        background: #eef4fb !important;
        color: #173d78 !important;
      }

      .lms-user-menu-link:focus-visible {
        outline: 2px solid #ff6b00;
        outline-offset: -2px;
      }

      @media (max-width: ${DESKTOP_BREAKPOINT}px) {
        html,
        body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        body.lms-navigation-open {
          overflow: hidden !important;
        }

        body:not(.lms-onboarding-mode) .lms-sidebar,
        body:not(.lms-onboarding-mode) #lms-sidebar {
          display: flex !important;
          position: fixed !important;
          inset: 0 auto 0 0 !important;
          width: min(300px, 86vw) !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          margin: 0 !important;
          transform: translate3d(-105%, 0, 0);
          transition: transform .22s ease;
          z-index: 10021 !important;
          box-shadow: 18px 0 44px rgba(17, 36, 67, .22);
          visibility: visible !important;
        }

        body.lms-navigation-open:not(.lms-onboarding-mode) .lms-sidebar,
        body.lms-navigation-open:not(.lms-onboarding-mode) #lms-sidebar {
          transform: translate3d(0, 0, 0);
        }

        body.lms-onboarding-mode .lms-sidebar,
        body.lms-onboarding-mode #lms-sidebar,
        body.lms-onboarding-mode .lms-sidebar-overlay,
        body.lms-onboarding-mode #lms-sidebar-overlay {
          display: none !important;
        }

        .lms-sidebar-inner {
          width: 100%;
          min-width: 0;
          height: 100%;
          overflow: hidden !important;
        }

        /*
           The base LMS stylesheet intentionally collapses the sidebar at
           <=1100px for small desktop screens. Mobile sits inside that same
           breakpoint, so the drawer must explicitly restore all navigation
           labels when it opens.
        */
        body:not(.lms-onboarding-mode) .lms-brand-copy,
        body:not(.lms-onboarding-mode) .lms-nav-text,
        body:not(.lms-onboarding-mode) .lms-nav-label,
        body:not(.lms-onboarding-mode) .lms-nav-badge,
        body:not(.lms-onboarding-mode) .lms-return-text,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-brand-copy,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-nav-text,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-nav-label,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-nav-badge,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-return-text {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          width: auto !important;
          max-width: none !important;
          overflow: visible !important;
        }

        body:not(.lms-onboarding-mode) .lms-sidebar-brand {
          flex: 0 0 auto;
        }

        body:not(.lms-onboarding-mode) .lms-brand {
          min-height: 96px !important;
          height: auto !important;
          padding: 16px 18px !important;
        }

        body:not(.lms-onboarding-mode) .lms-brand-logo {
          width: 145px !important;
          max-width: 145px !important;
          max-height: 48px !important;
          opacity: 1 !important;
        }

        body:not(.lms-onboarding-mode) .lms-brand-copy {
          display: block !important;
          margin-top: 5px !important;
        }

        body:not(.lms-onboarding-mode) .lms-brand-subtitle {
          display: block !important;
          font-size: 10px !important;
          letter-spacing: .11em !important;
          text-transform: uppercase !important;
          color: rgba(255,255,255,.62) !important;
        }

        .lms-sidebar-scroll {
          flex: 1 1 auto !important;
          min-height: 0;
          padding: 18px 14px !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        body:not(.lms-onboarding-mode) .lms-nav-group + .lms-nav-group {
          margin-top: 20px !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-label {
          display: block !important;
          width: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          margin: 0 0 8px 12px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          color: rgba(255,255,255,.46) !important;
          font-family: inherit !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          letter-spacing: .12em !important;
          text-transform: uppercase !important;
          text-align: left !important;
          cursor: default !important;
          pointer-events: none !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-label:hover,
        body:not(.lms-onboarding-mode) .lms-nav-label:focus,
        body:not(.lms-onboarding-mode) .lms-nav-label:focus-visible,
        body:not(.lms-onboarding-mode) .lms-nav-group.is-open > .lms-nav-label {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          color: rgba(255,255,255,.46) !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-label::before,
        body:not(.lms-onboarding-mode) .lms-nav-label::after {
          display: none !important;
          content: none !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-link,
        body:not(.lms-onboarding-mode) .lms-return-link,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-nav-link,
        body.lms-nav-collapsed:not(.lms-onboarding-mode) .lms-return-link {
          justify-content: flex-start !important;
          width: 100% !important;
          min-height: 46px !important;
          padding: 0 13px !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-icon {
          flex: 0 0 22px !important;
        }

        body:not(.lms-onboarding-mode) .lms-nav-text,
        body:not(.lms-onboarding-mode) .lms-return-text {
          display: block !important;
          margin-left: 12px !important;
          white-space: normal !important;
          line-height: 1.3 !important;
        }

        body:not(.lms-onboarding-mode) .lms-sidebar-footer {
          flex: 0 0 auto;
          padding: 12px 14px 16px !important;
        }

        .lms-sidebar-overlay,
        #lms-sidebar-overlay {
          display: none !important;
        }

        body.lms-navigation-open:not(.lms-onboarding-mode) .lms-sidebar-overlay,
        body.lms-navigation-open:not(.lms-onboarding-mode) #lms-sidebar-overlay {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          z-index: 10020 !important;
          background: rgba(14, 31, 56, .42) !important;
          backdrop-filter: blur(2px);
        }

        /* The legacy cloned mobile dropdown is no longer used. */
        .lms-mobile-dropdown,
        .lms-mobile-dropdown-backdrop {
          display: none !important;
        }

        body:not(.lms-course-player-immersive) .lms-main,
        body:not(.lms-course-player-immersive) main.lms-main {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: 0 !important;
        }

        body:not(.lms-course-player-immersive) .lms-topbar {
          position: sticky;
          top: 0;
          z-index: 10010;
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-height: 64px !important;
          height: auto !important;
          padding: 9px 12px !important;
        }

        body:not(.lms-course-player-immersive) .lms-topbar-left,
        body:not(.lms-course-player-immersive) .lms-topbar-right,
        body:not(.lms-course-player-immersive) .lms-search-wrap {
          min-width: 0;
        }

        body:not(.lms-course-player-immersive) .lms-topbar-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }

        body:not(.lms-course-player-immersive) .lms-menu-button,
        body:not(.lms-course-player-immersive) .lms-icon-button,
        body:not(.lms-course-player-immersive) .lms-user-button {
          min-width: 44px !important;
          min-height: 44px !important;
          flex: 0 0 auto;
        }

        body:not(.lms-course-player-immersive) .lms-menu-button {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
        }

        body:not(.lms-course-player-immersive) .lms-search-wrap,
        body:not(.lms-course-player-immersive) .lms-search {
          width: 100% !important;
        }

        body:not(.lms-course-player-immersive) .lms-search input {
          width: 100%;
          min-width: 0;
          font-size: 16px !important;
        }

        body:not(.lms-course-player-immersive) .lms-search-shortcut {
          display: none !important;
        }

        body:not(.lms-course-player-immersive) .lms-user-name,
        body:not(.lms-course-player-immersive) .lms-user-chevron {
          display: none !important;
        }

        body:not(.lms-course-player-immersive) .lms-user-button {
          padding: 4px !important;
        }

        .lms-user-menu {
          position: fixed !important;
          top: 70px !important;
          right: 10px !important;
          left: auto !important;
          width: min(286px, calc(100vw - 20px)) !important;
          max-width: calc(100vw - 20px) !important;
          z-index: 10030 !important;
        }

        .lms-user-menu-link {
          min-height: 44px;
          display: flex !important;
          align-items: center;
        }

        body:not(.lms-course-player-immersive) .lms-content {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        body:not(.lms-course-player-immersive) img,
        body:not(.lms-course-player-immersive) video,
        body:not(.lms-course-player-immersive) iframe,
        body:not(.lms-course-player-immersive) canvas {
          max-width: 100%;
        }

        body:not(.lms-course-player-immersive) input,
        body:not(.lms-course-player-immersive) select,
        body:not(.lms-course-player-immersive) textarea,
        body:not(.lms-course-player-immersive) button {
          max-width: 100%;
        }

        /* Common LMS multi-column page layouts collapse safely on phones/tablets. */
        body:not(.lms-course-player-immersive) .home-stat-strip,
        body:not(.lms-course-player-immersive) .home-main-grid,
        body:not(.lms-course-player-immersive) .home-learning-grid,
        body:not(.lms-course-player-immersive) .course-library-grid,
        body:not(.lms-course-player-immersive) .courses-grid,
        body:not(.lms-course-player-immersive) .my-courses-grid,
        body:not(.lms-course-player-immersive) .course-details-layout,
        body:not(.lms-course-player-immersive) .progress-grid,
        body:not(.lms-course-player-immersive) .certificates-grid,
        body:not(.lms-course-player-immersive) .account-layout,
        body:not(.lms-course-player-immersive) .orders-layout,
        body:not(.lms-course-player-immersive) .documents-grid,
        body:not(.lms-course-player-immersive) .docs-workspace,
        body:not(.lms-course-player-immersive) .appointments-grid,
        body:not(.lms-course-player-immersive) .support-workspace-grid,
        body:not(.lms-course-player-immersive) .quiz-layout,
        body:not(.lms-course-player-immersive) .assessment-layout {
          grid-template-columns: minmax(0, 1fr) !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        body:not(.lms-course-player-immersive) .docs-table,
        body:not(.lms-course-player-immersive) .orders-table,
        body:not(.lms-course-player-immersive) .certificates-table {
          display: block;
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Hamburger becomes an X while the navigation drawer is open. */
        [data-lms-menu-toggle] svg {
          overflow: visible;
        }

        [data-lms-menu-toggle] svg path {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .18s ease, opacity .18s ease;
        }

        body.lms-navigation-open [data-lms-menu-toggle] svg path:nth-child(1) {
          transform: translateY(5px) rotate(45deg);
        }

        body.lms-navigation-open [data-lms-menu-toggle] svg path:nth-child(2) {
          opacity: 0;
        }

        body.lms-navigation-open [data-lms-menu-toggle] svg path:nth-child(3) {
          transform: translateY(-5px) rotate(-45deg);
        }
      }

      @media (max-width: 620px) {
        body:not(.lms-course-player-immersive) .lms-topbar {
          grid-template-columns: auto minmax(0, 1fr) auto;
        }

        body:not(.lms-course-player-immersive) .lms-search-wrap {
          display: none !important;
        }

        body:not(.lms-course-player-immersive) .s4u-page-title {
          display: block !important;
          max-width: 44vw;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 800;
        }

        body:not(.lms-course-player-immersive) .lms-content {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }
      }

      @media (min-width: ${DESKTOP_BREAKPOINT + 1}px) {
        .lms-sidebar-overlay,
        #lms-sidebar-overlay {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function positionMobileDropdown(
    button,
    dropdown
  ) {
    const header =
      button.closest(
        ".lms-topbar, .lms-header, header"
      );

    const referenceRect =
      header
        ? header.getBoundingClientRect()
        : button.getBoundingClientRect();

    const top =
      Math.max(
        8,
        Math.round(
          referenceRect.bottom + 8
        )
      );

    dropdown.style.top =
      top + "px";

    dropdown.style.maxHeight =
      "calc(100vh - " +
      (top + 12) +
      "px)";
  }


  /* ============================================================
     DESKTOP SIDEBAR
     ============================================================

     The Learning Center stylesheet already owns the desktop sidebar
     presentation. Do not inject Customer Portal collapse/reopen controls
     here because those controls use different CSS classes.
  */


  /* ============================================================
     MOBILE NAVIGATION
     ============================================================ */

  function initializeMobileNavigation() {
    const button = document.querySelector("[data-lms-menu-toggle]");
    const sidebar = document.getElementById("lms-sidebar");
    const overlay = document.querySelector("[data-lms-sidebar-overlay]");

    if (!button || !sidebar) return;
    if (button.dataset.lmsNavigationToggleBound === "1") return;
    button.dataset.lmsNavigationToggleBound = "1";

    function isMobile() {
      return window.innerWidth <= DESKTOP_BREAKPOINT;
    }

    function closeMobileMenu() {
      document.body.classList.remove("lms-navigation-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
      if (overlay) overlay.setAttribute("aria-hidden", "true");
    }

    function openMobileMenu() {
      document.body.classList.add("lms-navigation-open");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Close navigation");
      if (overlay) overlay.setAttribute("aria-hidden", "false");
    }

    function applyDesktopState() {
      let collapsed = false;
      try {
        collapsed = localStorage.getItem("s4u-lms-sidebar-collapsed") === "1";
      } catch (_) {}

      document.body.classList.remove("lms-navigation-open");
      document.body.classList.toggle("lms-nav-collapsed", collapsed);
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute("aria-label", collapsed ? "Show navigation" : "Hide navigation");
      if (overlay) overlay.setAttribute("aria-hidden", "true");
    }

    if (isMobile()) {
      document.body.classList.remove("lms-nav-collapsed");
      closeMobileMenu();
    } else {
      applyDesktopState();
    }

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (isMobile()) {
        document.body.classList.remove("lms-nav-collapsed");
        if (document.body.classList.contains("lms-navigation-open")) {
          closeMobileMenu();
        } else {
          openMobileMenu();
        }
        return;
      }

      const collapsed = document.body.classList.toggle("lms-nav-collapsed");
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute("aria-label", collapsed ? "Show navigation" : "Hide navigation");
      try {
        localStorage.setItem("s4u-lms-sidebar-collapsed", collapsed ? "1" : "0");
      } catch (_) {}
    });

    if (overlay) {
      overlay.addEventListener("click", function (event) {
        event.preventDefault();
        closeMobileMenu();
      });
    }

    sidebar.addEventListener("click", function (event) {
      if (!isMobile()) return;
      const link = event.target.closest("a");
      if (link) closeMobileMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isMobile()) {
        closeMobileMenu();
      }
    });

    let lastMobile = isMobile();
    window.addEventListener("resize", function () {
      const mobileNow = isMobile();
      if (mobileNow === lastMobile) return;
      lastMobile = mobileNow;

      if (mobileNow) {
        document.body.classList.remove("lms-nav-collapsed");
        closeMobileMenu();
      } else {
        applyDesktopState();
      }
    });
  }


  /* ============================================================
     USER ACCOUNT MENU
     Shared here because every LMS page already loads lms-sidebar.js.
     Capture phase prevents older page bundles from double-toggling it.
     ============================================================ */
  function initializeUserMenu() {
    if (document.documentElement.dataset.lmsUserMenuInitialized === "true") {
      return;
    }
    document.documentElement.dataset.lmsUserMenuInitialized = "true";

    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-lms-user-button]");

      if (button) {
        const wrap = button.closest(".lms-user-wrap") || button.parentElement;
        const menu = wrap ? wrap.querySelector("[data-lms-user-menu]") : null;
        if (!menu) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        document.querySelectorAll("[data-lms-user-menu].is-open").forEach(function (other) {
          if (other !== menu) other.classList.remove("is-open");
        });

        const open = menu.classList.toggle("is-open");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }

      const insideMenu = event.target.closest("[data-lms-user-menu]");
      if (insideMenu) return;

      document.querySelectorAll("[data-lms-user-menu].is-open").forEach(function (menu) {
        menu.classList.remove("is-open");
      });
      document.querySelectorAll("[data-lms-user-button][aria-expanded=\"true\"]").forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
      });
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      document.querySelectorAll("[data-lms-user-menu].is-open").forEach(function (menu) {
        menu.classList.remove("is-open");
      });
      document.querySelectorAll("[data-lms-user-button][aria-expanded=\"true\"]").forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ============================================================
     SHELL ENHANCEMENTS
     Replaces lms-shell-v2.js and lms-shell-v3.js without observers.
     ============================================================ */
  function initializeShellEnhancements() {
    const page = (location.pathname.split("/").pop() || "lms-dashboard.html").toLowerCase();

    if (page === "lms-welcome.html") {
      document.body.classList.remove("lms-navigation-open");
      document.body.classList.add("lms-onboarding-mode");
      const app = document.querySelector(".lms-app");
      if (app && !document.querySelector(".onboard-brandbar")) {
        const bar = document.createElement("div");
        bar.className = "onboard-brandbar";
        bar.innerHTML = '<img src="images/logo.png" alt="screenings4u"><span class="divider" aria-hidden="true"></span><span>Learning Center</span><b>New Learner Orientation</b>';
        app.parentNode.insertBefore(bar, app);
      }
      return;
    }

    const button = document.querySelector("[data-lms-menu-toggle]");
    if (button && window.innerWidth > DESKTOP_BREAKPOINT) {
      let collapsed = false;
      try { collapsed = localStorage.getItem("s4u-lms-sidebar-collapsed") === "1"; } catch (_) {}
      document.body.classList.toggle("lms-nav-collapsed", collapsed);
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }

    const titles = {
      "lms-dashboard.html":"Home", "lms-my-courses.html":"My Learning", "lms-courses.html":"Course Library",
      "lms-course-details.html":"Course Details", "lms-progress.html":"Progress", "lms-certificates.html":"Certificates",
      "lms-documents.html":"Documents", "lms-orders.html":"Orders", "lms-live-training.html":"Live Training",
      "lms-my-appointments.html":"My Appointments", "lms-reschedule-appointment.html":"Reschedule Appointment", "lms-schedule-appointment.html":"Schedule Appointment",
      "lms-customer-scheduling.html":"Scheduling", "lms-support.html":"Training Support", "lms-notifications.html":"Notifications",
      "lms-account.html":"Account", "lms-quiz.html":"Knowledge Check", "lms-assessment.html":"Assessment"
    };
    const left = document.querySelector(".lms-topbar-left");
    if (left && !left.querySelector(".s4u-page-title")) {
      const title = document.createElement("span");
      title.className = "s4u-page-title";
      title.textContent = titles[page] || document.title.split("|")[0].trim() || "Learning Center";
      left.appendChild(title);
    }
  }


  function injectShellPageContext() {
    const topLeft = document.querySelector(".lms-topbar-left");
    if (!topLeft || topLeft.querySelector(".lms-shell-context")) return;

    const currentFile = (window.location.pathname.split("/").pop() || "lms-dashboard.html").toLowerCase();
    const activeLink = document.querySelector(`.lms-nav-link[data-lms-page="${currentFile}"]`);
    const pageName = activeLink?.querySelector(".lms-nav-text")?.textContent?.trim() || document.title.split("|")[0].trim() || "Learning Center";

    const context = document.createElement("div");
    context.className = "lms-shell-context";
    context.innerHTML = `<small>Learning Center</small><strong>${pageName}</strong>`;
    topLeft.appendChild(context);
  }

})();
