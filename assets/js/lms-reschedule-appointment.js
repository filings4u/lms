/* SOURCE: assets/js/lms-core-clean.js?v=20260915-clean3 */
/* SOURCE: assets/js/supabase-config.js */
/* SCREENINGS4U — TRAINING SUPABASE CONFIG — SESSION STORAGE ONLY */
(() => {
  "use strict";

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";

  window.SCREENINGS4U_SUPABASE_URL = SUPABASE_URL;
  window.SCREENINGS4U_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  if (
    !window.screenings4uSupabase &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    window.screenings4uSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage,
          storageKey: "s4u-training-auth-session"
        }
      }
    );
  }

  window.supabaseClient = window.screenings4uSupabase;

  window.getScreenings4uSupabase = function () {
    if (window.screenings4uSupabase) {
      return window.screenings4uSupabase;
    }

    throw new Error(
      "Supabase client is not initialized. Load @supabase/supabase-js before supabase-config.js."
    );
  };
})();

;
/* SOURCE: assets/js/core-auth.js */
/* ============================================================
   SCREENINGS4U — CORE AUTH
   TRAINING / LMS AUTHENTICATION

   PORTAL:
   - Training / LMS

   IMPORTANT:
   This copy is isolated to the standalone Training system.
   It never routes to Admin, Customer, Employer, or Employee portals.

   ============================================================ */

(() => {
  "use strict";

  /* ============================================================
     PORTAL CONFIGURATION
     ============================================================ */

  const PORTALS = Object.freeze({

    training: {
      login: "training-login.html",
      dashboard: "lms-dashboard.html",
      allowedRoles: []
    }

  });


  /* ============================================================
     AUTH STATE
     ============================================================ */

  let state = {
    initialized: false,
    session: null,
    user: null,
    profile: null,
    roles: [],
    primaryRole: null
  };


  /* ============================================================
     SUPABASE CLIENT
     ============================================================ */

  function getClient() {

    if (
      typeof window.getScreenings4uSupabase === "function"
    ) {
      return window.getScreenings4uSupabase();
    }

    if (
      window.screenings4uSupabase &&
      window.screenings4uSupabase.auth
    ) {
      return window.screenings4uSupabase;
    }

    if (
      window.supabaseClient &&
      window.supabaseClient.auth
    ) {
      return window.supabaseClient;
    }

    throw new Error(
      "Supabase client is not available. " +
      "Load Supabase and supabase-config.js before core-auth.js."
    );

  }


  /* ============================================================
     ROLE NORMALIZATION
     ============================================================ */

  function normalizeRole(value) {

    if (!value) {
      return null;
    }

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  }


  function uniqueRoles(values = []) {

    return [
      ...new Set(
        values
          .map(normalizeRole)
          .filter(Boolean)
      )
    ];

  }


  /* ============================================================
     GET PORTAL
     ============================================================ */

  function getPortal(portalName) {

    const name = String(portalName || "")
      .trim()
      .toLowerCase();

    const portal = PORTALS[name];

    if (!portal) {
      throw new Error(
        `Unknown portal "${portalName}".`
      );
    }

    return {
      name,
      ...portal
    };

  }


  /* ============================================================
     GET SESSION
     ============================================================ */

  async function getSession() {

    const client = getClient();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session || null;

  }


  /* ============================================================
     GET USER PROFILE

     The central profile table is user_profiles.
     This function does NOT require a nonexistent
     admin_profiles table.
     ============================================================ */

  async function getProfile(userId = null) {

    const client = getClient();

    let id = userId;

    if (!id) {

      const session = await getSession();

      if (!session?.user?.id) {
        return null;
      }

      id = session.user.id;

    }

    const {
      data,
      error
    } = await client
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {

      console.warn(
        "[S4UAuth] Unable to load user profile:",
        error
      );

      return null;

    }

    return data || null;

  }


  /* ============================================================
     GET USER ROLES

     Roles are loaded from:

     user_role_assignments
     ============================================================ */

  async function getRoles(userId = null) {

    const client = getClient();

    let id = userId;

    if (!id) {

      const session = await getSession();

      if (!session?.user?.id) {
        return [];
      }

      id = session.user.id;

    }


    const {
      data,
      error
    } = await client
      .from("user_role_assignments")
      .select("*")
      .eq("user_id", id);


    if (error) {

      console.error(
        "[S4UAuth] Unable to load user roles:",
        error
      );

      return [];

    }


    const foundRoles = [];

    (data || []).forEach((row) => {

      [
        row.role,
        row.role_name,
        row.role_code,
        row.role_key,
        row.app_role
      ].forEach((value) => {

        const role = normalizeRole(value);

        if (role) {
          foundRoles.push(role);
        }

      });

    });


    return uniqueRoles(foundRoles);

  }


  /* ============================================================
     CHECK PORTAL ACCESS

     This is the central authorization check.

     ADMIN:
       Any recognized administrative role.

     CUSTOMER:
       Customer role only.

     EMPLOYER:
       Employer role only.

     EMPLOYEE:
       Employee role only.
       Employee dashboard is LMS only.
     ============================================================ */

  function userCanAccessPortal(
    userRoles = [],
    portalName
  ) {

    const name = normalizeRole(portalName);

    if (name !== "training") {
      return false;
    }

    /*
      Training access is NOT decided by ordinary roles here.
      It is checked asynchronously through hasRole("training"),
      which calls can_access_training_portal().
    */
    return false;

  }


  /* ============================================================
     GET PRIMARY ROLE
     ============================================================ */

  function getPrimaryRole(userRoles = []) {

    /*
      This copy of core-auth.js is used only inside the
      standalone Training / LMS system.

      Do not infer or route to another portal from this file.
    */
    return "training";

  }


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize({
    force = false
  } = {}) {

    if (
      state.initialized &&
      !force
    ) {
      return {
        ...state,
        roles: [...state.roles]
      };
    }


    const session =
      await getSession();


    /* ----------------------------------------------------------
       NO SESSION
       ---------------------------------------------------------- */

    if (!session?.user) {

      state = {
        initialized: true,
        session: null,
        user: null,
        profile: null,
        roles: [],
        primaryRole: null
      };

      return {
        ...state,
        roles: []
      };

    }


    /* ----------------------------------------------------------
       AUTHENTICATED USER
       ---------------------------------------------------------- */

    const user =
      session.user;


    // Training authorization is handled by can_access_training_portal().
    // Do not fetch role assignments on every LMS page navigation.
    const profile = await getProfile(user.id);
    const roles = [];


    state = {

      initialized: true,

      session,

      user,

      profile,

      roles,

      primaryRole:
        getPrimaryRole(roles)

    };


    return {
      ...state,
      roles: [...roles]
    };

  }


  /* ============================================================
     HAS ROLE
     ============================================================ */

  async function hasRole(
    role,
    userId = null
  ) {

    const requestedRole = normalizeRole(role);
    if (!requestedRole) return false;

    if (requestedRole === "training") {
      const client = getClient();
      const { data, error } = await client.rpc("can_access_training_portal");
      if (error) {
        console.error("[S4UAuth] Training access check failed:", error);
        throw error;
      }

      return data === true;
    }

    const userRoles = await getRoles(userId);


    return userRoles.includes(
      requestedRole
    );

  }


  /* ============================================================
     HAS ANY ROLE
     ============================================================ */

  async function hasAnyRole(
    allowedRoles = [],
    userId = null
  ) {

    const allowed =
      uniqueRoles(allowedRoles);

    if (!allowed.length) {
      return false;
    }


    const userRoles =
      await getRoles(userId);


    return userRoles.some(
      (role) => allowed.includes(role)
    );

  }


  /* ============================================================
     GET DASHBOARD
     ============================================================ */

  function getDashboardForRole(role) {

    const normalizedRole = normalizeRole(role);

    if (
      !normalizedRole ||
      normalizedRole !== "training"
    ) {
      return null;
    }

    return PORTALS.training.dashboard;

  }


  /* ============================================================
     GET LOGIN PAGE
     ============================================================ */

  function getLoginForPortal(
    portalName = "training"
  ) {

    const name = normalizeRole(portalName);

    if (name !== "training") {
      return PORTALS.training.login;
    }

    return PORTALS.training.login;

  }




  /* ============================================================
     SAFE RETURN-TO SUPPORT
     ============================================================ */

  function getCurrentReturnTo() {

    return (
      window.location.pathname +
      window.location.search +
      window.location.hash
    );

  }


  function buildLoginRedirect(
    loginPage,
    { preserveReturnTo = true } = {}
  ) {

    const loginUrl = new URL(
      loginPage,
      window.location.origin + "/"
    );

    if (preserveReturnTo) {

      const currentPage =
        window.location.pathname
          .split("/")
          .filter(Boolean)
          .pop()
          ?.toLowerCase() || "";

      /*
       * Never send public authentication pages back to themselves.
       */
      if (
        currentPage !== "training-login.html" &&
        currentPage !== "reset-password.html"
      ) {
        loginUrl.searchParams.set(
          "returnTo",
          getCurrentReturnTo()
        );
      }
    }

    return loginUrl.href;

  }


  /* ============================================================
     REQUIRE AUTHENTICATION

     Example:

     S4UAuth.requireAuth({
       portal: "admin"
     });

     If there is no session, redirect to the portal login.
     If access is explicitly denied, sign out and redirect.
     Authorization/network errors are thrown and must not be
     converted into a false access-denied result.
     ============================================================ */

  async function requireAuth({
    portal = "training",
    loginPage = null
  } = {}) {

    let portalConfig = null;


    if (portal) {

      portalConfig =
        getPortal(portal);

    }


    const resolvedLoginPage =

      loginPage ||

      portalConfig?.login ||

      PORTALS.training.login;


    /* ----------------------------------------------------------
       LOAD AUTH STATE ONCE
       initialize() performs the single session lookup.
       ---------------------------------------------------------- */

    const authState = await initialize({ force: true });

    if (!authState?.session?.user) {
      window.location.replace(buildLoginRedirect(resolvedLoginPage));
      return null;
    }


    /* ----------------------------------------------------------
       NO PORTAL SPECIFIED
       ---------------------------------------------------------- */

    if (!portalConfig) {

      return authState;

    }


    /* ----------------------------------------------------------
       STRICT PORTAL ACCESS
       ---------------------------------------------------------- */

    const allowed =
      await hasRole(
        "training",
        authState.user?.id
      );


    if (!allowed) {

      console.warn(
        "[S4UAuth] Portal access denied.",
        {
          portal,
          userId:
            authState.user?.id,
          roles:
            authState.roles
        }
      );


      await signOutSilently();


      window.location.replace(
        buildLoginRedirect(
          resolvedLoginPage
        )
      );


      return null;

    }


    return authState;

  }


  /* ============================================================
     SIGN IN
     ============================================================ */

  async function signIn(
    email,
    password
  ) {

    const client =
      getClient();


    const {
      data,
      error
    } = await client
      .auth
      .signInWithPassword({

        email:
          String(
            email || ""
          ).trim(),

        password

      });


    if (error) {
      throw error;
    }


    /* Refresh auth state immediately */

    await initialize({
      force: true
    });


    return data;

  }


  /* ============================================================
     STRICT PORTAL SIGN IN

     IMPORTANT:

     The user is authenticated first.

     Then the user's roles are checked.

     If they do not belong to the portal:
     - session is destroyed
     - an error is returned
     - no other portal redirect occurs
     ============================================================ */

  async function signInToPortal(
    portalName,
    email,
    password
  ) {

    const requestedPortal =
      normalizeRole(portalName);

    if (requestedPortal !== "training") {
      throw new Error(
        "This authentication file is restricted to the Training Portal."
      );
    }

    const portal =
      getPortal("training");


    const result =
      await signIn(
        email,
        password
      );


    const authState =
      await initialize({
        force: true
      });


    if (!authState?.user?.id) {

      await signOutSilently();

      throw new Error(
        "Unable to verify your account."
      );

    }


    const authorized =
      await hasRole(
        "training",
        authState.user.id
      );


    if (!authorized) {

      console.warn(
        "[S4UAuth] Login denied for portal.",
        {
          portal:
            portalName,
          userId:
            authState.user.id,
          roles:
            authState.roles
        }
      );


      await signOutSilently();


      throw new Error(
        "This account does not have access to the training portal."
      );

    }


    return {

      ...result,

      portal,

      state:
        authState

    };

  }


  /* ============================================================
     SILENT SIGN OUT
     ============================================================ */

  async function signOutSilently() {

    try {

      const client =
        getClient();


      await client.auth.signOut();


    } catch (error) {

      console.error(
        "[S4UAuth] Unable to sign out:",
        error
      );

    }


    state = {

      initialized: true,
      session: null,
      user: null,
      profile: null,
      roles: [],
      primaryRole: null

    };

  }


  /* ============================================================
     SIGN OUT
     ============================================================ */

  async function signOut(loginPage = "training-login.html") {

    const destination =
      typeof loginPage === "object" && loginPage !== null
        ? loginPage.redirectTo || "training-login.html"
        : loginPage || "training-login.html";

    await signOutSilently();
    window.location.replace(destination);
  }


  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.S4UAuth = Object.freeze({

    /* Client */

    getClient,


    /* Session */

    getSession,


    /* State */

    initialize,


    /* User */

    getProfile,


    /* Roles */

    getRoles,

    hasRole,

    hasAnyRole,

    normalizeRole,

    userCanAccessPortal,

    getPrimaryRole,


    /* Portals */

    PORTALS,

    getPortal,

    getDashboardForRole,

    getLoginForPortal,


    /* Protection */

    requireAuth,


    /* Authentication */

    signIn,

    signInToPortal,

    signOut,

    signOutSilently

  });

})();
;

/* SOURCE: assets/js/pages/lms-my-appointments.js?v=20260915-clean3 */
/* SOURCE: assets/js/ui.js */
/* ============================================================
   screenings4u — CORE UI
   Replaces browser alert()/confirm() for application actions.
   ============================================================ */

(() => {
  "use strict";

  let activeModal = null;
  let activeResolve = null;

  function ensureRoot() {
    let root = document.getElementById("s4uModalRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "s4uModalRoot";
      root.className = "s4u-modal-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function close(result = false) {
    if (!activeModal) return;
    activeModal.remove();
    activeModal = null;
    document.body.classList.remove("s4u-modal-open");
    if (activeResolve) {
      const resolve = activeResolve;
      activeResolve = null;
      resolve(result);
    }
  }

  function modal({
    title = "screenings4u",
    message = "",
    type = "info",
    confirmText = "Continue",
    cancelText = "Cancel",
    showCancel = false,
    onConfirm = null
  } = {}) {
    close();

    const root = ensureRoot();
    const wrapper = document.createElement("div");

    wrapper.className = `s4u-modal ${type}`;
    wrapper.setAttribute("role", "dialog");
    wrapper.setAttribute("aria-modal", "true");

    wrapper.innerHTML = `
      <div class="s4u-modal-backdrop" data-modal-close></div>
      <section class="s4u-modal-panel">
        <div class="s4u-modal-brand">
          <img class="s4u-modal-brand-logo" src="images/logo.png" alt="screenings4u">
        </div>
        <div class="s4u-modal-body">
          <div class="s4u-modal-icon" aria-hidden="true"></div>
          <div class="s4u-modal-content">
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
          </div>
          <div class="s4u-modal-actions">
            ${showCancel ? `<button class="s4u-modal-button secondary" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>` : ""}
            <button class="s4u-modal-button primary" type="button" data-modal-confirm>${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </section>
    `;

    root.appendChild(wrapper);
    activeModal = wrapper;
    document.body.classList.add("s4u-modal-open");

    wrapper
      .querySelector("[data-modal-close]")
      ?.addEventListener("click", () => close(false));

    wrapper
      .querySelector("[data-modal-cancel]")
      ?.addEventListener("click", () => close(false));

    wrapper
      .querySelector("[data-modal-confirm]")
      ?.addEventListener("click", async () => {
        const button =
          wrapper.querySelector("[data-modal-confirm]");

        button.disabled = true;

        try {
          if (typeof onConfirm === "function") {
            await onConfirm();
          }

          close(true);
        } catch (error) {
          button.disabled = false;

          toast(
            error?.message ||
              "Unable to complete this action.",
            "error"
          );
        }
      });

    const promise = new Promise(resolve => { activeResolve = resolve; });
    promise.close = () => close(false);
    return promise;
  }

  function toast(
    message,
    type = "info"
  ) {
    let root =
      document.getElementById(
        "s4uToastRoot"
      );

    if (!root) {
      root =
        document.createElement("div");

      root.id = "s4uToastRoot";
      root.className =
        "s4u-toast-root";

      document.body.appendChild(
        root
      );
    }

    const item =
      document.createElement("div");

    item.className =
      `s4u-toast ${type}`;

    item.textContent =
      message;

    root.appendChild(
      item
    );

    requestAnimationFrame(
      () =>
        item.classList.add(
          "show"
        )
    );

    setTimeout(() => {
      item.classList.remove(
        "show"
      );

      setTimeout(
        () => item.remove(),
        180
      );
    }, 4200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formModal({
    title = "screenings4u",
    message = "",
    fields = [],
    confirmText = "Save",
    cancelText = "Cancel",
    onSubmit = null
  } = {}) {
    close();

    const root = ensureRoot();
    const wrapper =
      document.createElement("div");

    wrapper.className =
      "s4u-modal info";

    wrapper.setAttribute(
      "role",
      "dialog"
    );

    wrapper.setAttribute(
      "aria-modal",
      "true"
    );

    wrapper.innerHTML = `
      <div class="s4u-modal-backdrop" data-modal-close></div>
      <section class="s4u-modal-panel s4u-form-modal-panel">
        <div class="s4u-modal-brand">
          <img class="s4u-modal-brand-logo" src="images/logo.png" alt="screenings4u">
        </div>
        <div class="s4u-modal-body">
          <div class="s4u-modal-content">
            <h2>${escapeHtml(title)}</h2>
            ${message ? `<p>${escapeHtml(message)}</p>` : ""}
            <form class="s4u-form-modal-form">
            ${fields.map((field) => `
              <label class="s4u-form-modal-field">
                <span>${escapeHtml(field.label || field.name)}</span>
                ${field.type === "textarea"
                  ? `<textarea name="${escapeHtml(field.name)}" rows="4">${escapeHtml(field.value ?? "")}</textarea>`
                  : field.type === "select"
                    ? `<select name="${escapeHtml(field.name)}">${(field.options || []).map(o => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(field.value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>`
                    : `<input type="${escapeHtml(field.type || "text")}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value ?? "")}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ""} ${field.max !== undefined ? `max="${escapeHtml(field.max)}"` : ""}>`}
              </label>
            `).join("")}
            <div class="s4u-modal-actions">
              <button class="s4u-modal-button secondary" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>
              <button class="s4u-modal-button primary" type="submit">${escapeHtml(confirmText)}</button>
            </div>
          </form>
          </div>
        </div>
      </section>
    `;

    root.appendChild(
      wrapper
    );

    activeModal = wrapper;

    document.body.classList.add(
      "s4u-modal-open"
    );

    wrapper
      .querySelector("[data-modal-close]")
      ?.addEventListener(
        "click",
        close
      );

    wrapper
      .querySelector("[data-modal-cancel]")
      ?.addEventListener(
        "click",
        close
      );

    wrapper
      .querySelector("form")
      ?.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          const button =
            wrapper.querySelector(
              'button[type="submit"]'
            );

          button.disabled =
            true;

          const formData =
            new FormData(
              event.currentTarget
            );

          const values =
            Object.fromEntries(
              formData.entries()
            );

          try {
            if (
              typeof onSubmit ===
              "function"
            ) {
              await onSubmit(
                values
              );
            }

            close();
          } catch (error) {
            button.disabled =
              false;

            toast(
              error?.message ||
                "Unable to complete this action.",
              "error"
            );
          }
        }
      );

    wrapper
      .querySelector(
        "input, select, textarea"
      )
      ?.focus();

    return {
      close
    };
  }

  window.S4UUI =
    Object.freeze({
      modal,
      formModal,
      toast,
      closeModal: close
    });
})();

;
/* SOURCE: assets/js/training-auth-guard.js */
/**
 * screenings4u — Training LMS bootstrap
 * One authentication/onboarding pipeline shared by every LMS script.
 */
(() => {
  "use strict";

  const CONSENT_VERSION = "2026-08-23";
  const ONBOARDING_PAGE = "lms-welcome.html";

  function currentPage() {
    return (location.pathname.split("/").pop() || "").split("?")[0].toLowerCase();
  }

  function onboardingCacheKey(userId) {
    return `s4u:lms:onboarding:${CONSENT_VERSION}:${userId}`;
  }

  async function verifyOnboarding(state) {
    if (currentPage() === ONBOARDING_PAGE) return true;

    const userId = state?.user?.id;
    if (!userId) throw new Error("Training user is unavailable.");

    try {
      if (sessionStorage.getItem(onboardingCacheKey(userId)) === "1") return true;
    } catch (_) {}

    document.documentElement.classList.add("s4u-onboarding-pending");

    const client = window.getScreenings4uSupabase?.();
    if (!client) throw new Error("Supabase client is unavailable.");

    const session = state.session;
    if (!session?.access_token) throw new Error("Training session is unavailable.");

    const response = await fetch(
      `${window.SCREENINGS4U_SUPABASE_URL}/functions/v1/lms-learner-documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: window.SCREENINGS4U_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: "status" })
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to verify onboarding status.");

    const consent = data.consent || {};
    const complete = Boolean(
      consent.consent_version === CONSENT_VERSION &&
      consent.accepted_terms &&
      consent.accepted_refund_policy &&
      consent.accepted_disclaimer &&
      consent.accepted_mock_requirements
    );

    if (!complete) {
      const target = new URL(ONBOARDING_PAGE, location.href);
      target.searchParams.set("returnTo", location.pathname + location.search + location.hash);
      location.replace(target.href);
      return false;
    }

    try { sessionStorage.setItem(onboardingCacheKey(userId), "1"); } catch (_) {}
    document.documentElement.classList.remove("s4u-onboarding-pending");
    return true;
  }

  async function bootstrap() {
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

  // Starts as soon as this script is parsed; no DOMContentLoaded delay.
  window.S4UTrainingReady = bootstrap();
})();

;

/* SOURCE: assets/js/lms.js */
/* ============================================================
   SCREENINGS4U LEARNING CENTER
   SHARED LMS APPLICATION JAVASCRIPT
   ============================================================ */

(function () {
  "use strict";

  var authState = {
    client: null,
    user: null,
    profile: null
  };

  var readyResolve;
  var readyReject;

  var ready = new Promise(function (resolve, reject) {
    readyResolve = resolve;
    readyReject = reject;
  });

  function initializeLms() {

    initializeNotificationBellNavigation();
    initializeUserMenu();
    initializeSearchShortcut();
    initializeSignOut();

    initializeAuthenticatedLearner()
      .then(async function () {

        try {
          await refreshNotificationBell();
        } catch (notificationError) {
          console.warn("[LMS] Notification bell could not be refreshed:", notificationError);
        }

        readyResolve({
          client: authState.client,
          user: authState.user,
          profile: authState.profile
        });
      })
      .catch(function (error) {
        console.error("[LMS] Initialization failed:", error);
        readyReject(error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeLms);
  } else {
    initializeLms();
  }

  async function initializeAuthenticatedLearner() {
    if (!window.S4UTrainingReady) {
      throw new Error("Training bootstrap is unavailable. Load training-auth-guard.js before lms.js.");
    }

    var trainingState = await window.S4UTrainingReady;
    if (!trainingState?.user) {
      throw new Error("Training authentication could not be completed.");
    }

    authState.client = await getSupabaseClient();
    authState.user = trainingState.user;
    authState.profile = trainingState.profile || {
      id: trainingState.user.id,
      email: trainingState.user.email || ""
    };

    if (String(authState.profile.status || "active").toLowerCase() !== "active") {
      try { await window.S4UAuth?.signOutSilently?.(); } catch (_) {}
      window.location.replace("training-login.html");
      throw new Error("This account is inactive.");
    }

    var profile = authState.profile;
    setLearnerProfile({
      name: profile.display_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        trainingState.user.email || "Learner",
      email: profile.email || trainingState.user.email || ""
    });
  }

  

  

  

  function initializeNotificationBellNavigation() {
    document
      .querySelectorAll('.lms-icon-button[aria-label="Notifications"]')
      .forEach(function (bell) {
        if (bell.tagName === "A") {
          if (!bell.getAttribute("href")) {
            bell.setAttribute("href", "lms-notifications.html");
          }
          bell.setAttribute("title", "Notifications");
          return;
        }

        if (!bell.dataset.lmsNotificationBound) {
          bell.dataset.lmsNotificationBound = "1";
          bell.setAttribute("title", "Notifications");
          bell.addEventListener("click", function () {
            window.location.href = "lms-notifications.html";
          });
        }
      });
  }

  async function refreshNotificationBell() {
    if (!authState.client || !authState.user?.id) return;

    var notificationsResult = await authState.client
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", authState.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (notificationsResult.error) {
      throw notificationsResult.error;
    }

    var notificationIds = (notificationsResult.data || [])
      .map(function (row) { return row.id; })
      .filter(Boolean);

    var readIds = new Set();

    if (notificationIds.length) {
      var readsResult = await authState.client
        .from("customer_notification_reads")
        .select("notification_id")
        .eq("user_id", authState.user.id)
        .in("notification_id", notificationIds);

      if (readsResult.error) {
        throw readsResult.error;
      }

      (readsResult.data || []).forEach(function (row) {
        if (row.notification_id) readIds.add(row.notification_id);
      });
    }

    var unreadCount = notificationIds.filter(function (id) {
      return !readIds.has(id);
    }).length;

    document.querySelectorAll(".lms-notification-dot").forEach(function (dot) {
      dot.style.display = unreadCount > 0 ? "" : "none";
      dot.setAttribute("aria-hidden", "true");
    });

    document
      .querySelectorAll('.lms-icon-button[aria-label="Notifications"]')
      .forEach(function (bell) {
        var label = unreadCount > 0
          ? "Notifications, " + unreadCount + " unread"
          : "Notifications";
        bell.setAttribute("aria-label", label);
        bell.setAttribute("title", label);
      });

    window.dispatchEvent(new CustomEvent("lms:notifications-updated", {
      detail: { unreadCount: unreadCount }
    }));
  }

  function initializeUserMenu() {
    var userButton = document.querySelector("[data-lms-user-button]");
    var userMenu = document.querySelector("[data-lms-user-menu]");

    if (!userButton || !userMenu) return;

    userButton.addEventListener("click", function (event) {
      event.stopPropagation();

      var isOpen = userMenu.classList.toggle("is-open");
      userButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", function (event) {
      if (
        !userButton.contains(event.target) &&
        !userMenu.contains(event.target)
      ) {
        userMenu.classList.remove("is-open");
        userButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initializeSearchShortcut() {
    document.addEventListener("keydown", function (event) {
      var isModifier = event.ctrlKey || event.metaKey;

      if (isModifier && event.key.toLowerCase() === "k") {
        event.preventDefault();

        var searchInput = document.querySelector("[data-lms-search]");
        if (searchInput) searchInput.focus();
      }
    });
  }

  function setLearnerProfile(profile) {
    profile = profile || {};

    var name = profile.name || "Learner";
    var email = profile.email || "";
    var initials = profile.initials || getInitials(name);

    updateElements("[data-lms-learner-name]", name);
    updateElements("[data-lms-learner-initials]", initials);
    updateElements("[data-lms-user-menu-name]", name);
    updateElements("[data-lms-user-menu-email]", email);
  }

  function updateElements(selector, value) {
    document.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function getInitials(name) {
    if (!name) return "L";

    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  function initializeSignOut() {
    document.querySelectorAll("[data-lms-sign-out]").forEach(function (button) {
      button.addEventListener("click", async function () {
        button.disabled = true;

        try {
          if (
            window.S4UAuth &&
            typeof window.S4UAuth.signOut === "function"
          ) {
            await window.S4UAuth.signOut({
              redirectTo: "training-login.html"
            });
            return;
          }

          var client = await getSupabaseClient();
          await client.auth.signOut();
        } catch (error) {
          console.error("[LMS] Sign out error:", error);
        }

        window.location.replace("training-login.html");
      });
    });
  }

  async function getSupabaseClient() {
    if (
      typeof window.getScreenings4uSupabase === "function"
    ) {
      return await window.getScreenings4uSupabase();
    }

    if (
      window.screenings4uSupabase &&
      window.screenings4uSupabase.auth
    ) {
      return window.screenings4uSupabase;
    }

    if (
      window.supabaseClient &&
      window.supabaseClient.auth
    ) {
      return window.supabaseClient;
    }

    throw new Error(
      "Supabase client is unavailable. Load supabase-config.js before lms.js."
    );
  }

  window.LMS = window.LMS || {};
  window.LMS.ready = ready;
  window.LMS.setLearnerProfile = setLearnerProfile;
  window.LMS.getInitials = getInitials;
  window.LMS.closeNavigation = closeMobileNavigation;
  window.LMS.getSupabaseClient = getSupabaseClient;
  window.LMS.refreshNotificationBell = refreshNotificationBell;
  window.LMS.getCurrentUser = function () {
    return authState.user;
  };
  window.LMS.getProfile = function () {
    return authState.profile;
  };
})();

;
/* SOURCE: assets/js/lms-my-appointments.js */
(()=>{
  const state={db:null,appointments:[]};
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.addEventListener('DOMContentLoaded',init);

  async function init(){
    state.db=await getClient();
    if(!state.db){return showError('Unable to connect to your Screenings4u account.');}
    await loadAppointments();
  }

  async function getClient(){
    for(let i=0;i<50;i++){
      try{
        if(typeof window.getScreenings4uSupabase==='function'){
          const c=await window.getScreenings4uSupabase();
          if(c?.functions)return c;
        }
        if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;
        if(window.supabaseClient?.functions)return window.supabaseClient;
      }catch{}
      await new Promise(r=>setTimeout(r,80));
    }
    return null;
  }

  async function invoke(body){
    const {data,error}=await state.db.functions.invoke('scheduling-booking',{body});
    if(error){
      let message=error.message;
      try{message=(await error.context?.clone?.().json())?.error||message}catch{}
      throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    return data;
  }

  async function loadAppointments(){
    try{
      const data=await invoke({action:'my_appointments'});
      state.appointments=data.appointments||[];
      render();
    }catch(e){showError(e.message||'Unable to load your appointments.');}
  }

  function render(){
    const list=$('appointmentsList');
    $('appointmentsCount').textContent=String(state.appointments.length);
    if(!state.appointments.length){
      list.innerHTML=`<div class="appointments-empty"><div class="appointments-empty-icon">▣</div><h3>No appointments yet</h3><p>Schedule your first live Microsoft Teams training session.</p><a class="appointments-primary-action" href="lms-schedule-appointment.html">Schedule Appointment</a></div>`;
      return;
    }

    const now=Date.now();
    const sorted=[...state.appointments].sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
    list.innerHTML=sorted.map(a=>{
      const start=new Date(a.start_at), end=new Date(a.end_at);
      const status=String(a.status||'scheduled').toLowerCase();
      const active=!['cancelled','completed','no_show'].includes(status) && end.getTime()+3600000>now;
      const opens=start.getTime()-30*60000;
      const joinWindow=active && now>=opens && now<=end.getTime()+3600000;
      const date=start.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
      const time=start.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
      const endTime=end.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
      const badge=status==='cancelled'?'Cancelled':active?'Scheduled':status.replace(/_/g,' ');
      const joinLabel=joinWindow?'Enter Live Training':'View Live Training';
      const openingNote=active&&!joinWindow?'<span class="appointment-opening-note">Live Training opens 30 minutes before start</span>':'';
      return `<article class="appointment-item ${active?'is-active':'is-past'}">
        <div class="appointment-date"><strong>${esc(start.toLocaleDateString([],{day:'2-digit'}))}</strong><span>${esc(start.toLocaleDateString([],{month:'short'}).toUpperCase())}</span></div>
        <div class="appointment-main">
          <div class="appointment-title-row"><div><span class="appointment-provider">MICROSOFT TEAMS</span><h3>${esc(a.title||'Live Training')}</h3></div><span class="appointment-status">${esc(badge)}</span></div>
          <div class="appointment-meta"><span>${esc(date)}</span><span>${esc(time)} – ${esc(endTime)}</span><span>Tracking: ${esc(a.tracking_number||'—')}</span></div>
          <div class="appointment-host">Instructor: ${esc(a.host_name||'Screenings4u Training')}</div>
        </div>
        <div class="appointment-actions">
          ${active?`<a class="appointment-join" href="lms-live-training.html?appointment=${encodeURIComponent(a.id)}">${joinLabel}</a>${openingNote}`:''}
        </div>
      </article>`;
    }).join('');
  }

  function showError(message){
    const el=$('appointmentsMessage');
    el.textContent=message;
    el.hidden=false;
    $('appointmentsList').innerHTML='<div class="appointments-empty"><h3>Appointments unavailable</h3><p>Please refresh the page or try again shortly.</p></div>';
  }
})();

;
/* SOURCE: assets/js/branded-popups.js */
(() => {
  'use strict';

  const BRAND = '#ff6b00';
  const BRAND_LOGO = 'images/logo.png';
  const state = { resolve: null, confirmResolve: null, lastMessage: '', lastAt: 0 };

  function ensurePopup() {
    if (document.getElementById('s4u-global-popup')) return;
    const style = document.createElement('style');
    style.id = 's4u-global-popup-style';
    style.textContent = `
      [role="alert"].login-status,[role="alert"].handoff-error{display:none!important}
      .s4u-popup{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .s4u-popup.is-open{display:flex}
      .s4u-popup__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(4px)}
      .s4u-popup__card{position:relative;width:min(440px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.24);text-align:center;animation:s4uPopupIn .18s ease-out}
      .s4u-popup__brand{padding:20px 24px 17px;border-bottom:3px solid ${BRAND};background:#fff}.s4u-popup__brand img{display:block;width:min(220px,70%);height:auto;margin:auto}.s4u-popup__body{padding:26px 26px 24px}
      .s4u-popup__title{margin:0 0 9px;color:#24467f;font-size:22px;line-height:1.25;font-weight:800}
      .s4u-popup__message{margin:0;color:#475569;font-size:15px;line-height:1.65;white-space:pre-line;overflow-wrap:anywhere}
      .s4u-popup__actions{display:flex;justify-content:center;gap:10px;margin-top:23px}
      .s4u-popup__button{min-width:120px;min-height:44px;border:0;border-radius:12px;padding:11px 18px;background:${BRAND};color:#fff;font:inherit;font-weight:800;cursor:pointer}.s4u-popup__button--secondary{background:#e2e8f0;color:#0f172a}
      .s4u-popup__button:hover{background:#e66000}
      .s4u-popup__button:focus-visible{outline:3px solid rgba(255,107,0,.24);outline-offset:3px}
      @keyframes s4uPopupIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
      @media(max-width:520px){.s4u-popup{padding:14px}.s4u-popup__card{padding:26px 18px 20px;border-radius:18px}.s4u-popup__actions{display:grid}.s4u-popup__button{width:100%}}
    `;
    document.head.appendChild(style);

    const popup = document.createElement('div');
    popup.id = 's4u-global-popup';
    popup.className = 's4u-popup';
    popup.setAttribute('aria-hidden', 'true');
    popup.innerHTML = `
      <div class="s4u-popup__backdrop" data-s4u-popup-close></div>
      <section class="s4u-popup__card" role="dialog" aria-modal="true" aria-labelledby="s4u-popup-title" aria-describedby="s4u-popup-message">
        <div class="s4u-popup__brand"><img src="${BRAND_LOGO}" alt="screenings4u"></div>
        <div class="s4u-popup__body">
          <h2 class="s4u-popup__title" id="s4u-popup-title">screenings4u</h2>
          <p class="s4u-popup__message" id="s4u-popup-message"></p>
          <div class="s4u-popup__actions"><button class="s4u-popup__button s4u-popup__button--secondary" type="button" data-s4u-popup-cancel hidden>Cancel</button><button class="s4u-popup__button" type="button" data-s4u-popup-ok>OK</button></div>
        </div>
      </section>`;
    document.body.appendChild(popup);
    popup.querySelector('[data-s4u-popup-ok]').addEventListener('click', () => finishPopup(true));
    popup.querySelector('[data-s4u-popup-cancel]').addEventListener('click', () => finishPopup(false));
    popup.querySelector('[data-s4u-popup-close]').addEventListener('click', closePopup);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && popup.classList.contains('is-open')) closePopup(); });
  }

  function finishPopup(value) {
    if (state.confirmResolve) { const resolve = state.confirmResolve; state.confirmResolve = null; resolve(value); }
    closePopup();
  }

  function closePopup() {
    const popup = document.getElementById('s4u-global-popup');
    if (!popup) return;
    const active = document.activeElement;
    if (active && popup.contains(active) && typeof active.blur === 'function') active.blur();
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    if (state.resolve) { const resolve = state.resolve; state.resolve = null; resolve(); }
  }

  function showPopup(message, options = {}) {
    const text = String(message ?? '').trim();
    if (!text) return Promise.resolve();
    const now = Date.now();
    if (text === state.lastMessage && now - state.lastAt < 700) return Promise.resolve();
    state.lastMessage = text; state.lastAt = now;
    ensurePopup();
    const popup = document.getElementById('s4u-global-popup');
    popup.querySelector('#s4u-popup-title').textContent = options.title || 'Screenings4u';
    popup.querySelector('#s4u-popup-message').textContent = text;
    popup.querySelector('[data-s4u-popup-ok]').textContent = options.confirmText || 'OK';
    const cancel = popup.querySelector('[data-s4u-popup-cancel]'); cancel.hidden = true;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    setTimeout(() => popup.querySelector('[data-s4u-popup-ok]')?.focus(), 0);
    return new Promise(resolve => { state.resolve = resolve; });
  }

  function confirmPopup(message, options={}) {
    ensurePopup();
    const popup=document.getElementById('s4u-global-popup');
    popup.querySelector('#s4u-popup-title').textContent=options.title||'Please Confirm';
    popup.querySelector('#s4u-popup-message').textContent=String(message??'');
    popup.querySelector('[data-s4u-popup-ok]').textContent=options.confirmText||'Continue';
    const cancel=popup.querySelector('[data-s4u-popup-cancel]'); cancel.hidden=false; cancel.textContent=options.cancelText||'Cancel';
    popup.classList.add('is-open'); popup.setAttribute('aria-hidden','false');
    setTimeout(() => popup.querySelector('[data-s4u-popup-ok]')?.focus(), 0);
    return new Promise(resolve=>{state.confirmResolve=resolve;});
  }

  window.S4UPopup = { show: showPopup, confirm: confirmPopup, close: closePopup, success: (m,t='Success') => showPopup(m,{title:t}), error: (m,t='Something went wrong') => showPopup(m,{title:t}), info: (m,t='Screenings4u') => showPopup(m,{title:t}) };
  window.alert = message => { showPopup(message); };

  function watchInlineAlerts() {
    document.querySelectorAll('[role="alert"]').forEach(el => {
      let previous = (el.textContent || '').trim();
      const observer = new MutationObserver(() => {
        const current = (el.textContent || '').trim();
        if (current && current !== previous) {
          const lower = current.toLowerCase();
          const title = /success|updated|sent|complete|saved/.test(lower) ? 'Success' : /error|invalid|failed|unable|expired|incorrect/.test(lower) ? 'Something went wrong' : 'Screenings4u';
          showPopup(current, { title });
        }
        previous = current;
      });
      observer.observe(el, { childList:true, characterData:true, subtree:true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { ensurePopup(); watchInlineAlerts(); });
  else { ensurePopup(); watchInlineAlerts(); }
})();

;


/* SOURCE: inline script */

window.addEventListener('DOMContentLoaded',()=>{
  const list=document.getElementById('appointmentsList');
  const obs=new MutationObserver(()=>{
    if(document.body.dataset.rescheduleView==='true' && list && /do not have any appointments/i.test(list.textContent||'')){
      list.innerHTML='<div class="appointments-loading"><p>You do not have an upcoming appointment to reschedule yet. When you book one, it will appear here automatically.</p></div>';
    }
  });
  if(list) obs.observe(list,{childList:true,subtree:true});
});
