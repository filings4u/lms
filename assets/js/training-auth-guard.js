/**
 * screenings4u — Training LMS authentication + onboarding gate
 * Every protected LMS page waits for this promise before loading learner data.
 */
(() => {
  "use strict";

  const CONSENT_VERSION = "2026-08-23";
  const ONBOARDING_PAGE = "lms-welcome.html";
  const LOCK_STYLE_ID = "s4u-training-onboarding-lock-style";

  function currentPage() {
    return (location.pathname.split("/").pop() || "").split("?")[0].split("#")[0].toLowerCase();
  }

  function installLockStyle() {
    if (document.getElementById(LOCK_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOCK_STYLE_ID;
    style.textContent = `
      html.s4u-auth-pending body,
      html.s4u-onboarding-pending body {
        visibility: hidden !important;
      }
      html.s4u-authenticated body {
        visibility: visible !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildWelcomeTarget(returnTo) {
    const target = new URL(ONBOARDING_PAGE, location.href);
    if (returnTo) target.searchParams.set("returnTo", returnTo);
    return target;
  }

  function currentReturnTarget() {
    return location.pathname + location.search + location.hash;
  }

  function consentIsComplete(data) {
    const consent = data?.consent || {};
    return Boolean(
      data?.hasDocument === true &&
      consent.consent_version === CONSENT_VERSION &&
      consent.accepted_terms === true &&
      consent.accepted_refund_policy === true &&
      consent.accepted_disclaimer === true &&
      consent.accepted_mock_requirements === true
    );
  }

  function welcomeReturnDestination() {
    const requested = new URLSearchParams(location.search).get("returnTo");
    if (!requested) return "lms-dashboard.html";

    try {
      const url = new URL(requested, location.origin);
      if (url.origin !== location.origin) return "lms-dashboard.html";
      if ((url.pathname.split("/").pop() || "").toLowerCase() === ONBOARDING_PAGE) {
        return "lms-dashboard.html";
      }
      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "lms-dashboard.html";
    }
  }

  async function verifyOnboarding(state) {
    const isWelcomePage = currentPage() === ONBOARDING_PAGE;
    const userId = state?.user?.id;
    const session = state?.session;
    if (!userId) throw new Error("Training user is unavailable.");
    if (!session?.access_token) throw new Error("Training session is unavailable.");

    if (!isWelcomePage) {
      document.documentElement.classList.add("s4u-onboarding-pending");
    }

    let response;
    try {
      response = await fetch(
        `${window.SCREENINGS4U_SUPABASE_URL}/functions/v1/lms-learner-documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: window.SCREENINGS4U_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: "status" }),
          cache: "no-store"
        }
      );
    } catch (error) {
      console.error("[Training onboarding gate] status request failed", error);

      // The Welcome page must remain usable if verification itself fails.
      if (isWelcomePage) return true;

      const target = buildWelcomeTarget(currentReturnTarget());
      target.searchParams.set("reason", "verification");
      location.replace(target.href);
      return false;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[Training onboarding gate] status verification failed", data);

      // Do not trap a learner outside the form they need to complete.
      if (isWelcomePage) return true;

      const target = buildWelcomeTarget(currentReturnTarget());
      target.searchParams.set("reason", "verification");
      location.replace(target.href);
      return false;
    }

    if (consentIsComplete(data)) {
      // A learner who already completed onboarding should never be trapped on Welcome.
      if (isWelcomePage) {
        location.replace(welcomeReturnDestination());
        return false;
      }

      document.documentElement.classList.remove("s4u-onboarding-pending");
      return true;
    }

    // Incomplete learners are allowed to use the Welcome form, but nowhere else.
    if (isWelcomePage) return true;

    location.replace(buildWelcomeTarget(currentReturnTarget()).href);
    return false;
  }

  async function bootstrap() {
    installLockStyle();
    document.documentElement.classList.add("s4u-auth-pending");

    if (currentPage() !== ONBOARDING_PAGE) {
      document.documentElement.classList.add("s4u-onboarding-pending");
    }

    try {
      if (!window.S4UAuth?.requireAuth) {
        throw new Error("core-auth.js must load before training-auth-guard.js.");
      }

      const state = await window.S4UAuth.requireAuth({
        portal: "training",
        loginPage: "training-login.html"
      });
      if (!state) return null;

      if (!(await verifyOnboarding(state))) return null;

      if (window.S4USessionSecurity?.preflight) {
        const allowed = await window.S4USessionSecurity.preflight(state);
        if (!allowed) return null;
      }

      document.documentElement.classList.remove("s4u-auth-pending", "s4u-onboarding-pending");
      document.documentElement.classList.add("s4u-authenticated");

      window.S4UTrainingAuthState = state;
      window.dispatchEvent(new CustomEvent("s4u:training-ready", { detail: state }));
      return state;
    } catch (error) {
      console.error("[Training bootstrap]", error);
      document.documentElement.classList.add("s4u-auth-error");
      document.documentElement.classList.remove("s4u-authenticated");
      throw error;
    }
  }

  // Starts immediately so downstream LMS scripts cannot load learner/course data first.
  window.S4UTrainingReady = bootstrap();
})();
