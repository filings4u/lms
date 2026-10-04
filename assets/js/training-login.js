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


/* SOURCE: assets/js/training-login.js?v=20260903-2 */
(() => {
  "use strict";

  const DASHBOARD_PAGE = "lms-welcome.html";
  const RESET_PAGE = "reset-password.html";

  const BLOCKED_RETURN_PAGES = new Set([
    "training-login.html",
    "reset-password.html"
  ]);

  const form =
    document.getElementById("trainingLoginForm");

  const emailInput =
    document.getElementById("email");

  const passwordInput =
    document.getElementById("password");

  const loginButton =
    document.getElementById("loginButton");

  const loginStatus =
    document.getElementById("loginStatus");

  const passwordToggle =
    document.getElementById("passwordToggle");

  const forgotPasswordButton =
    document.getElementById("forgotPasswordBtn");

  const currentYear =
    document.getElementById("currentYear");


  if (currentYear) {
    currentYear.textContent =
      new Date().getFullYear();
  }


  function setStatus(message, type = "") {
    if (!loginStatus) {
      return;
    }

    loginStatus.textContent =
      message || "";

    loginStatus.className =
      `login-status${type ? ` ${type}` : ""}`;
  }


  function setLoading(isLoading) {
    if (!loginButton) {
      return;
    }

    loginButton.disabled =
      Boolean(isLoading);

    loginButton.textContent =
      isLoading
        ? "VERIFYING TRAINING ACCESS..."
        : "SIGN IN TO TRAINING PORTAL";
  }


  function getAuth() {
    const auth =
      window.S4UAuth;

    if (
      !auth ||
      typeof auth.signInToPortal !== "function" ||
      typeof auth.initialize !== "function" ||
      typeof auth.hasRole !== "function" ||
      typeof auth.getClient !== "function"
    ) {
      throw new Error(
        "The training authentication service is unavailable. Please refresh the page."
      );
    }

    return auth;
  }


  /*
   * ==========================================================
   * SAFE RETURN-TO SUPPORT
   * ==========================================================
   *
   * Accepted:
   *
   *   ?returnTo=course-player.html?course=123
   *
   * Rejected:
   *
   *   https://evil.example/
   *   //evil.example/
   *   javascript:...
   *
   * The final destination must remain on the
   * training.screenings4u.com origin.
   */

  function getSafeReturnTo() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const raw =
      params.get("returnTo");

    if (!raw) {
      return null;
    }

    try {
      const target =
        new URL(
          raw,
          window.location.origin + "/"
        );

      if (
        target.origin !==
        window.location.origin
      ) {
        return null;
      }

      const filename =
        target.pathname
          .split("/")
          .filter(Boolean)
          .pop()
          ?.toLowerCase() || "";

      if (
        BLOCKED_RETURN_PAGES.has(
          filename
        )
      ) {
        return null;
      }

      return (
        target.pathname +
        target.search +
        target.hash
      );

    } catch {
      return null;
    }
  }


  function getDestination() {
    return (
      getSafeReturnTo() ||
      DASHBOARD_PAGE
    );
  }


  function openDestination() {
    window.location.replace(
      getDestination()
    );
  }


  function bindPasswordToggle() {
    if (
      !passwordToggle ||
      !passwordInput
    ) {
      return;
    }

    passwordToggle.addEventListener(
      "click",
      () => {
        const showPassword =
          passwordInput.type ===
          "password";

        passwordInput.type =
          showPassword
            ? "text"
            : "password";

        passwordToggle.setAttribute(
          "aria-label",
          showPassword
            ? "Hide password"
            : "Show password"
        );

        passwordToggle.setAttribute(
          "aria-pressed",
          showPassword
            ? "true"
            : "false"
        );
      }
    );
  }


  function bindForgotPassword() {
    if (
      !forgotPasswordButton ||
      !emailInput
    ) {
      return;
    }

    forgotPasswordButton.addEventListener(
      "click",
      async () => {
        const address =
          emailInput.value.trim();

        if (!address) {
          setStatus(
            "Enter your email address first.",
            "error"
          );

          emailInput.focus();

          return;
        }

        forgotPasswordButton.disabled =
          true;

        setStatus(
          "Sending password reset instructions..."
        );

        try {
          const auth =
            getAuth();

          const client =
            auth.getClient();

          const resetUrl =
            new URL(
              RESET_PAGE,
              window.location.origin + "/"
            );

          const returnTo =
            getSafeReturnTo();

          /*
           * Preserve the originally requested Training page
           * through password recovery as well.
           */

          if (returnTo) {
            resetUrl.searchParams.set(
              "returnTo",
              returnTo
            );
          }

          const { error } =
            await client.auth
              .resetPasswordForEmail(
                address,
                {
                  redirectTo:
                    resetUrl.href
                }
              );

          if (error) {
            throw error;
          }

          setStatus(
            "Password reset instructions have been sent if that account exists.",
            "success"
          );

        } catch (error) {
          console.error(
            "[Training Login] Password reset failed:",
            error
          );

          setStatus(
            "Unable to send password reset instructions right now.",
            "error"
          );

        } finally {
          forgotPasswordButton.disabled =
            false;
        }
      }
    );
  }


  async function redirectExistingTrainingSession() {
    try {
      const auth =
        getAuth();

      const state =
        await auth.initialize({
          force: true
        });

      if (!state?.user?.id) {
        return;
      }

      const allowed =
        await auth.hasRole(
          "training",
          state.user.id
        );

      if (allowed) {
        openDestination();
      }

    } catch (error) {
      /*
       * Do not sign out here.
       *
       * A temporary authorization/network failure
       * must not destroy an otherwise valid session.
       */

      console.warn(
        "[Training Login] Existing training session could not be verified:",
        error
      );
    }
  }


  async function handleSubmit(event) {
    event.preventDefault();

    const address =
      emailInput?.value?.trim() || "";

    const secret =
      passwordInput?.value || "";

    if (
      !address ||
      !secret
    ) {
      setStatus(
        "Enter your email and password.",
        "error"
      );

      return;
    }

    setLoading(true);

    setStatus(
      "Verifying your training access..."
    );

    try {
      const auth =
        getAuth();

      /*
       * signInToPortal("training"):
       *
       * 1. authenticates the user
       * 2. initializes fresh auth state
       * 3. verifies Training access
       * 4. rejects explicitly unauthorized users
       */

      const result =
        await auth.signInToPortal(
          "training",
          address,
          secret
        );

      if (
        !result?.state?.user?.id
      ) {
        throw new Error(
          "We could not verify your training account."
        );
      }

      setStatus(
        "Access verified. Opening the Learning Center...",
        "success"
      );

      /*
       * Return to the originally requested page when
       * present, otherwise open the Training dashboard.
       */

      openDestination();

    } catch (error) {
      console.error(
        "[Training Login] Sign-in failed:",
        error
      );

      setStatus(
        error?.message ||
          "Unable to sign in. Please check your credentials and try again.",
        "error"
      );

      setLoading(false);
    }
  }


  function initializeTrainingLogin() {
    if (!form) {
      console.error(
        "[Training Login] #trainingLoginForm was not found."
      );

      return;
    }

    try {
      getAuth();

    } catch (error) {
      console.error(
        "[Training Login] Initialization failed:",
        error
      );

      setStatus(
        error.message,
        "error"
      );

      setLoading(false);

      return;
    }

    bindPasswordToggle();

    bindForgotPassword();

    form.addEventListener(
      "submit",
      handleSubmit
    );

    redirectExistingTrainingSession();
  }


  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeTrainingLogin,
      {
        once: true
      }
    );

  } else {
    initializeTrainingLogin();
  }

})();

/* SOURCE: assets/js/branded-popups.js?v=20260911-1 */
(() => {
  'use strict';

  const BRAND = '#ff6b00';
  const BRAND_LOGO = 'images/logo.png';
  const state = { resolve: null, confirmResolve: null, lastMessage: '', lastAt: 0 };
  const ICONS = {
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3.5h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.73 3h15.34a2 2 0 0 0 1.73-3L13.7 3.7a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6m0-9h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  function messageText(value, fallback='Unable to complete this request.') {
    if (value instanceof Error && value.message) return value.message;
    if (typeof value === 'string') return value.trim() || fallback;
    if (value && typeof value === 'object') return String(value.message || value.error || value.details || fallback);
    return fallback;
  }
  const NO_POPUP_PAGE = /(?:^|\/)(?:[^/?#]*(?:login|reset-password|forgot-password|recover|recovery|create-password|account-setup|welcome|onboarding|handoff)[^/?#]*)(?:\.html)?$/i.test(location.pathname);

  function showInlineAuthMessage(message, options = {}) {
    const text = messageText(message, options.fallback || 'Unable to complete this request.');
    if (!text) return Promise.resolve();
    let node = document.querySelector('[data-auth-status], .login-status, #resetStatus, #consentStatus, [role="alert"]');
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-auth-status','');
      node.setAttribute('role','status');
      node.style.cssText='margin:14px 0;padding:12px 14px;border:1px solid #dbe4ef;border-radius:10px;background:#f8fafc;color:#334155;font:600 14px/1.5 Inter,system-ui,sans-serif';
      const form = document.querySelector('form');
      (form || document.body).appendChild(node);
    }
    node.hidden = false;
    node.textContent = text;
    const bad = /error|invalid|failed|unable|expired|incorrect|required/i.test((options.title||'')+' '+text);
    node.style.color = bad ? '#991b1b' : '#166534';
    node.style.borderColor = bad ? '#fecaca' : '#bbf7d0';
    node.style.background = bad ? '#fff1f2' : '#f0fdf4';
    return Promise.resolve();
  }


  function ensurePopup() {
    if (NO_POPUP_PAGE) return;
    if (document.getElementById('s4u-global-popup')) return;
    const style = document.createElement('style');
    style.id = 's4u-global-popup-style';
    style.textContent = `
      [role="alert"].login-status,[role="alert"].handoff-error{display:none!important}
      .s4u-popup{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .s4u-popup.is-open{display:flex}
      .s4u-popup__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(4px)}
      .s4u-popup__card{position:relative;width:min(440px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.24);text-align:center;animation:s4uPopupIn .18s ease-out}
      .s4u-popup__brand{padding:20px 24px 17px;border-bottom:3px solid ${BRAND};background:#fff}.s4u-popup__brand img{display:block;width:min(220px,70%);height:auto;margin:auto}.s4u-popup__body{padding:26px 26px 24px}.s4u-popup__icon{width:46px;height:46px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:#eef4ff;color:#24467f}.s4u-popup__icon svg{width:24px;height:24px}.s4u-popup__icon[data-type="error"]{background:#fff1f0;color:#b42318}.s4u-popup__icon[data-type="success"]{background:#edf9f1;color:#237447}
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
          <div class="s4u-popup__icon" data-s4u-popup-icon data-type="info">${ICONS.info}</div>
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
    if (NO_POPUP_PAGE) return showInlineAuthMessage(message, options);
    const text = messageText(message, options.fallback || 'Unable to complete this request.');
    if (!text) return Promise.resolve();
    const now = Date.now();
    if (text === state.lastMessage && now - state.lastAt < 700) return Promise.resolve();
    state.lastMessage = text; state.lastAt = now;
    ensurePopup();
    const popup = document.getElementById('s4u-global-popup');
    popup.querySelector('#s4u-popup-title').textContent = options.title || 'Screenings4u';
    const iconType = ['error','success','info'].includes(options.type) ? options.type : 'info';
    const icon = popup.querySelector('[data-s4u-popup-icon]');
    if (icon) { icon.dataset.type = iconType; icon.innerHTML = ICONS[iconType]; }
    popup.querySelector('#s4u-popup-message').textContent = text;
    popup.querySelector('[data-s4u-popup-ok]').textContent = options.confirmText || 'OK';
    const cancel = popup.querySelector('[data-s4u-popup-cancel]'); cancel.hidden = true;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    setTimeout(() => popup.querySelector('[data-s4u-popup-ok]')?.focus(), 0);
    return new Promise(resolve => { state.resolve = resolve; });
  }

  function confirmPopup(message, options={}) {
    if (NO_POPUP_PAGE) return Promise.resolve(true);
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

  window.S4UPopup = { show: showPopup, confirm: confirmPopup, close: closePopup, success: (m,t='Success') => showPopup(m,{title:t,type:'success'}), error: (m,t='Something went wrong') => showPopup(m,{title:t,type:'error'}), info: (m,t='Screenings4u') => showPopup(m,{title:t,type:'info'}) };
  window.alert = message => { showPopup(message); };

  function watchInlineAlerts() {
    if (NO_POPUP_PAGE) return;
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { if (!NO_POPUP_PAGE) ensurePopup(); watchInlineAlerts(); });
  else { if (!NO_POPUP_PAGE) ensurePopup(); watchInlineAlerts(); }
})();
