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


/* SOURCE: assets/js/session-security.js?v=20260925-lockdown */
/**
 * screenings4u — Universal Portal Session Security
 * 10-minute inactivity timeout with branded one-minute warning.
 * Activity is synchronized across tabs on the same portal origin.
 * Training pages only count meaningful course-player interactions.
 */
(()=>{
  "use strict";
  const IDLE_LIMIT=10*60*1000;
  const WARNING=60*1000;
  const THROTTLE=750;
  const ACTIVITY_KEY="s4u-security-last-activity-v2";
  const WARNING_ID="s4u-session-warning";
  let logoutTimer=null, warningTimer=null, countdownTimer=null;
  let lastActivity=0, started=false, signingOut=false;

  const portal=()=>String(document.body?.dataset?.s4uPortal||document.documentElement?.dataset?.s4uPortal||inferPortal()).toLowerCase();
  function inferPortal(){
    const n=(location.pathname.split('/').pop()||'').toLowerCase();
    if(n.startsWith('admin-')) return 'admin';
    if(n.startsWith('customer-')) return 'customer';
    if(n.startsWith('employer-')) return 'employer';
    if(n.startsWith('employee-')) return 'employee';
    if(n.includes('course')||n.includes('lesson')||n.includes('training')||location.hostname==='training.screenings4u.com') return 'training';
    return '';
  }
  function storage(){try{return localStorage}catch{return sessionStorage}}
  function readActivity(){const n=Number(storage().getItem(ACTIVITY_KEY)||0);return Number.isFinite(n)?n:0}
  function writeActivity(v){try{storage().setItem(ACTIVITY_KEY,String(v))}catch{}}
  function clearTimers(){clearTimeout(logoutTimer);clearTimeout(warningTimer);clearInterval(countdownTimer);logoutTimer=warningTimer=countdownTimer=null}
  function removeWarning(){document.getElementById(WARNING_ID)?.remove()}
  function loginPage(){
    const p=portal();
    return window.S4UAuth?.getLoginForPortal?.(p) || (p==='training'?'https://training.screenings4u.com/training-login.html':`${p||'customer'}-login.html`);
  }
  async function signOut(){
    if(signingOut) return; signingOut=true; clearTimers(); removeWarning();
    const dest=loginPage();
    try{
      if(window.S4UAuth?.signOut){await window.S4UAuth.signOut({redirectTo:dest});return}
      const c=window.screenings4uSupabase||window.supabaseClient;
      if(c?.auth?.signOut) await c.auth.signOut();
    }catch(e){console.error('[Session security] sign out failed',e)}
    try{storage().removeItem(ACTIVITY_KEY)}catch{}
    location.replace(dest);
  }
  function button(label,fn,primary){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText=`min-height:44px;padding:0 18px;border-radius:9px;border:1px solid ${primary?'#ff6b00':'#24467f'};background:${primary?'#ff6b00':'#fff'};color:${primary?'#fff':'#24467f'};font:800 14px Inter,Arial,sans-serif;cursor:pointer`;b.addEventListener('click',fn);return b}
  function showWarning(){
    if(signingOut||document.getElementById(WARNING_ID)) return;
    let seconds=60;
    const o=document.createElement('div');o.id=WARNING_ID;o.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(16,47,85,.78);font-family:Inter,Arial,sans-serif';
    const m=document.createElement('section');m.setAttribute('role','alertdialog');m.setAttribute('aria-modal','true');m.style.cssText='width:min(470px,100%);padding:30px;border-radius:16px;background:#fff;border-top:5px solid #ff6b00;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:center';
    const brand=document.createElement('div');brand.textContent='SCREENINGS4U';brand.style.cssText='font-size:11px;letter-spacing:.14em;font-weight:900;color:#ff6b00;margin-bottom:10px';
    const h=document.createElement('h2');h.textContent='Your session is about to end';h.style.cssText='margin:0 0 10px;color:#102f55;font-size:24px';
    const p=document.createElement('p');p.textContent='For your security, you will be signed out after 10 minutes of inactivity.';p.style.cssText='margin:0 0 10px;color:#667892;line-height:1.55';
    const c=document.createElement('p');c.style.cssText='margin:0 0 22px;color:#1d2d45';const strong=document.createElement('strong');strong.textContent='60';c.append('Signing out in ',strong,' seconds.');
    const a=document.createElement('div');a.style.cssText='display:flex;justify-content:center;gap:10px;flex-wrap:wrap';a.append(button('Stay Logged In',()=>touch(true),true),button('Sign Out Now',signOut,false));
    m.append(brand,h,p,c,a);o.append(m);document.body.append(o);m.querySelector('button')?.focus();
    countdownTimer=setInterval(()=>{seconds-=1;strong.textContent=String(Math.max(0,seconds));if(seconds<=0)signOut()},1000);
  }
  function schedule(){
    if(!started||signingOut) return; clearTimers(); removeWarning();
    const elapsed=Math.max(0,Date.now()-lastActivity), remaining=Math.max(0,IDLE_LIMIT-elapsed);
    if(!remaining){signOut();return}
    const warnIn=Math.max(0,remaining-WARNING); if(!warnIn)showWarning(); else warningTimer=setTimeout(showWarning,warnIn);
    logoutTimer=setTimeout(signOut,remaining);
  }
  function touch(force=false){if(!started||signingOut)return;const now=Date.now();if(!force&&now-lastActivity<THROTTLE)return;lastActivity=now;writeActivity(now);schedule()}
  function isTrainingMeaningful(target){
    if(portal()!=='training') return true;
    const el=target?.closest?.('[data-s4u-course-player],[data-course-player],#course-player,.course-player,.lesson-player,.video-player,button,a,input,select,textarea,[role="button"]');
    return !!el;
  }
  function onActivity(e){if(isTrainingMeaningful(e.target))touch(false)}
  function establishBaseline(state){
    const stored=readActivity();
    const signedInAt=Date.parse(state?.user?.last_sign_in_at||'')||0;
    if(!stored||stored<signedInAt){lastActivity=Date.now();writeActivity(lastActivity)}else lastActivity=stored;
  }
  async function preflight(state){establishBaseline(state);if(Date.now()-lastActivity>=IDLE_LIMIT){await signOut();return false}return true}
  function start(ev){if(started||signingOut)return;started=true;establishBaseline(ev?.detail||null);['pointerdown','keydown','touchstart','input','change'].forEach(n=>document.addEventListener(n,onActivity,{passive:true}));if(portal()!=='training')document.addEventListener('scroll',onActivity,{passive:true});document.addEventListener('play',onActivity,true);document.addEventListener('seeked',onActivity,true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){lastActivity=readActivity()||lastActivity;schedule()}});window.addEventListener('storage',e=>{if(e.key===ACTIVITY_KEY){lastActivity=Number(e.newValue||0)||lastActivity;schedule()}});schedule()}
  window.addEventListener('s4u:authenticated',start);
  window.addEventListener('s4u:training-ready',start);
  window.S4USessionSecurity=Object.freeze({start,reset:()=>touch(true),touch:()=>touch(true),signOut,preflight,isExpired:()=>!!readActivity()&&Date.now()-readActivity()>=IDLE_LIMIT});
})();


/* SOURCE: assets/js/training-auth-guard.js */
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


/* SOURCE: assets/js/lms.js?v=20260830-2110 */
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


/* SOURCE: assets/js/lms-course-player.js?v=20260915-2 */
/* ============================================================
   SCREENINGS4U LEARNING CENTER
   COURSE PLAYER — FULL LEARNER RUNTIME
   ============================================================ */

(function () {
  "use strict";

  var TABLES = Object.freeze({
    enrollments: "lms_enrollments",
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks",
    media: "lms_media",
    quizzes: "lms_quizzes",
    assessments: "lms_assessments",
    lessonProgress: "lms_lesson_progress",
    blockProgress: "lms_block_progress"
  });

  var state = {
    db: null,
    user: null,
    enrollment: null,
    course: null,
    sections: [],
    lessons: [],
    progress: new Map(),
    blockProgress: new Map(),
    blocksByLesson: new Map(),
    mediaById: new Map(),
    quizzesByLesson: new Map(),
    assessmentsByLesson: new Map(),
    currentIndex: 0,
    renderingLesson: false
  };

  document.addEventListener("DOMContentLoaded", function () {
    initialize().catch(function (error) {
      console.error("[LMS Course Player]", error);
      showError(error);
    });
  });


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {
    if (!window.LMS || !window.LMS.ready) {
      throw new Error("Shared LMS authentication is unavailable.");
    }

    var auth = await window.LMS.ready;

    state.db = auth.client;
    state.user = auth.user;

    if (!state.db || typeof state.db.from !== "function") {
      throw new Error("Supabase client is unavailable.");
    }

    injectRuntimeStyles();
    ensureLessonContentHost();

    var params = new URLSearchParams(window.location.search);

    var courseId =
      params.get("course") ||
      params.get("course_id") ||
      "";

    var enrollmentId =
      params.get("enrollment") ||
      params.get("enrollment_id") ||
      "";

    var lessonId =
      params.get("lesson") ||
      params.get("lesson_id") ||
      "";

    await loadEnrollment(courseId, enrollmentId);
    await loadCourse();
    await loadCurriculum();
    await loadLessonContent();
    await loadProgress();

    if (lessonId) {
      var requested =
        state.lessons.findIndex(function (lesson) {
          return lesson.id === lessonId;
        });

      if (
        requested >= 0 &&
        canOpenLesson(requested)
      ) {
        state.currentIndex = requested;
      } else {
        state.currentIndex = firstIncompleteIndex();
      }
    } else {
      state.currentIndex = firstIncompleteIndex();
    }

    renderCourseHeader();
    renderCurriculum();
    bindNavigation();

    await renderCurrentLesson(false);

    exposePlayerApi();
  }


  /* ============================================================
     AUTHORIZED ENROLLMENT
     ============================================================ */

  async function loadEnrollment(courseId, enrollmentId) {
    var query =
      state.db
        .from(TABLES.enrollments)
        .select("*")
        .eq("user_id", state.user.id);

    if (enrollmentId) {
      query = query.eq("id", enrollmentId);
    } else if (courseId) {
      query = query.eq("course_id", courseId);
    } else {
      throw new Error("A course or enrollment ID is required.");
    }

    var result =
      await query
        .in("status", ["active", "completed"])
        .order(
          "last_activity_at",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "You do not have an active enrollment for this course."
      );
    }

    if (
      courseId &&
      result.data.course_id !== courseId
    ) {
      throw new Error(
        "This enrollment does not belong to the requested course."
      );
    }

    state.enrollment = result.data;
  }


  /* ============================================================
     COURSE
     ============================================================ */

  async function loadCourse() {
    var result =
      await state.db
        .from(TABLES.courses)
        .select("*")
        .eq(
          "id",
          state.enrollment.course_id
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "This course is not currently published."
      );
    }

    state.course = result.data;
  }


  /* ============================================================
     PUBLISHED CURRICULUM
     ============================================================ */

  async function loadCurriculum() {
    var sectionResult =
      await state.db
        .from(TABLES.sections)
        .select("*")
        .eq(
          "course_id",
          state.course.id
        )
        .eq(
          "is_published",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (sectionResult.error) {
      throw sectionResult.error;
    }

    state.sections =
      sectionResult.data || [];

    var sectionIds =
      state.sections.map(
        function (section) {
          return section.id;
        }
      );

    if (!sectionIds.length) {
      state.lessons = [];
      return;
    }

    var lessonResult =
      await state.db
        .from(TABLES.lessons)
        .select("*")
        .in(
          "section_id",
          sectionIds
        )
        .eq(
          "status",
          "published"
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (lessonResult.error) {
      throw lessonResult.error;
    }

    var sectionOrder =
      new Map(
        state.sections.map(
          function (section, index) {
            return [
              section.id,
              index
            ];
          }
        )
      );

    state.lessons =
      (lessonResult.data || [])
        .sort(
          function (a, b) {
            var sectionCompare =
              (sectionOrder.get(a.section_id) || 0) -
              (sectionOrder.get(b.section_id) || 0);

            if (sectionCompare !== 0) {
              return sectionCompare;
            }

            return (
              Number(a.sort_order || 0) -
              Number(b.sort_order || 0)
            );
          }
        );
  }


  /* ============================================================
     LESSON CONTENT
     ============================================================ */

  async function loadLessonContent() {
    state.blocksByLesson = new Map();
    state.mediaById = new Map();
    state.quizzesByLesson = new Map();
    state.assessmentsByLesson = new Map();

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    if (!lessonIds.length) {
      return;
    }

    var results =
      await Promise.all([
        state.db
          .from(TABLES.blocks)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .order(
            "sort_order",
            {
              ascending: true
            }
          ),

        state.db
          .from(TABLES.quizzes)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          ),

        state.db
          .from(TABLES.assessments)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .eq(
            "status",
            "published"
          )
      ]);

    var blockResult = results[0];
    var quizResult = results[1];
    var assessmentResult = results[2];

    if (blockResult.error) {
      throw blockResult.error;
    }

    if (quizResult.error) {
      throw quizResult.error;
    }

    if (assessmentResult.error) {
      throw assessmentResult.error;
    }

    (blockResult.data || [])
      .forEach(
        function (block) {
          if (
            !state.blocksByLesson.has(
              block.lesson_id
            )
          ) {
            state.blocksByLesson.set(
              block.lesson_id,
              []
            );
          }

          state.blocksByLesson
            .get(block.lesson_id)
            .push(block);
        }
      );

    (quizResult.data || [])
      .forEach(
        function (quiz) {
          state.quizzesByLesson.set(
            quiz.lesson_id,
            quiz
          );
        }
      );

    (assessmentResult.data || [])
      .forEach(
        function (assessment) {
          if (
            !state.assessmentsByLesson.has(
              assessment.lesson_id
            )
          ) {
            state.assessmentsByLesson.set(
              assessment.lesson_id,
              assessment
            );
          }
        }
      );

    var mediaIds =
      [
        ...new Set(
          (blockResult.data || [])
            .map(
              function (block) {
                return block.media_id;
              }
            )
            .filter(Boolean)
        )
      ];

    if (!mediaIds.length) {
      return;
    }

    var mediaResult =
      await state.db
        .from(TABLES.media)
        .select("*")
        .in(
          "id",
          mediaIds
        );

    if (mediaResult.error) {
      throw mediaResult.error;
    }

    state.mediaById =
      new Map(
        (mediaResult.data || [])
          .map(
            function (media) {
              return [
                media.id,
                media
              ];
            }
          )
      );
  }


  /* ============================================================
     PROGRESS
     ============================================================ */

  async function loadProgress() {
    state.progress = new Map();

    if (!state.lessons.length) {
      return;
    }

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    var result =
      await state.db
        .from(TABLES.lessonProgress)
        .select("*")
        .eq(
          "enrollment_id",
          state.enrollment.id
        )
        .in(
          "lesson_id",
          lessonIds
        );

    if (result.error) {
      throw result.error;
    }

    state.progress =
      new Map(
        (result.data || [])
          .map(
            function (row) {
              return [
                row.lesson_id,
                row
              ];
            }
          )
      );

    var blockResult =
      await state.db
        .from(TABLES.blockProgress)
        .select("*")
        .eq("enrollment_id", state.enrollment.id);

    if (blockResult.error) {
      throw blockResult.error;
    }

    state.blockProgress = new Map(
      (blockResult.data || []).map(function (row) {
        return [row.block_id, row];
      })
    );
  }


  /* ============================================================
     HEADER
     ============================================================ */

  function renderCourseHeader() {
    setText(
      ".course-player-kicker",
      "Learning Center"
    );

    setText(
      ".course-player-title",
      state.course.title ||
      "Training Course"
    );

    setText(
      ".course-player-subtitle",
      state.course.short_description ||
      state.course.description ||
      "Continue your training from where you left off."
    );

    var detailLink =
      document.querySelector(
        ".course-player-breadcrumb a[href^='lms-course-details']"
      );

    if (detailLink) {
      detailLink.textContent =
        state.course.title ||
        "Course";

      detailLink.href =
        "lms-course-details.html?course=" +
        encodeURIComponent(
          state.course.id
        );
    }

    updateProgressSummary();
  }


  /* ============================================================
     SIDEBAR CURRICULUM
     ============================================================ */

  function renderCurriculum() {
    var host =
      document.querySelector(
        ".course-player-sidebar-scroll"
      );

    if (!host) {
      return;
    }

    if (
      !state.sections.length ||
      !state.lessons.length
    ) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "No published lessons are available for this course yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      state.sections
        .map(
          function (
            section,
            sectionIndex
          ) {
            var lessons =
              state.lessons.filter(
                function (lesson) {
                  return (
                    lesson.section_id ===
                    section.id
                  );
                }
              );

            if (!lessons.length) {
              return "";
            }

            var containsCurrent =
              lessons.some(
                function (lesson) {
                  return (
                    state.lessons.indexOf(
                      lesson
                    ) ===
                    state.currentIndex
                  );
                }
              );

            return `
              <div
                class="course-player-module ${containsCurrent ? "is-open" : ""}"
                data-section-id="${escapeHtml(section.id)}"
              >
                <button
                  type="button"
                  class="course-player-module-button"
                  aria-expanded="${containsCurrent ? "true" : "false"}"
                >
                  <span class="course-player-module-left">
                    <span class="course-player-module-number">
                      ${String(sectionIndex + 1).padStart(2, "0")}
                    </span>

                    <span class="course-player-module-name">
                      ${escapeHtml(
                        section.title ||
                        "Module " +
                        (sectionIndex + 1)
                      )}
                    </span>
                  </span>

                  <svg
                    class="course-player-module-chevron"
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </button>

                <div class="course-player-lessons">
                  ${
                    lessons
                      .map(
                        function (lesson) {
                          var index =
                            state.lessons.findIndex(
                              function (row) {
                                return (
                                  row.id ===
                                  lesson.id
                                );
                              }
                            );

                          var completed =
                            isLessonComplete(
                              lesson.id
                            );

                          var locked =
                            !canOpenLesson(
                              index
                            );

                          return `
                            <button
                              type="button"
                              class="course-player-lesson-link ${
                                index === state.currentIndex
                                  ? "is-active"
                                  : ""
                              } ${
                                completed
                                  ? "is-complete"
                                  : ""
                              } ${
                                locked
                                  ? "is-locked"
                                  : ""
                              }"
                              data-live-lesson-index="${index}"
                              ${locked ? "disabled" : ""}
                              title="${locked ? "Complete the previous required lesson first." : ""}"
                            >
                              <span class="course-player-lesson-status">
                                ${
                                  completed
                                    ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>'
                                    : locked
                                      ? "•"
                                      : ""
                                }
                              </span>

                              <span class="course-player-lesson-copy">
                                <span class="course-player-lesson-name">
                                  ${escapeHtml(
                                    lesson.title ||
                                    "Lesson"
                                  )}
                                </span>

                                <span class="course-player-lesson-meta">
                                  ${escapeHtml(
                                    lessonMeta(
                                      lesson
                                    )
                                  )}
                                </span>
                              </span>
                            </button>
                          `;
                        }
                      )
                      .join("")
                  }
                </div>
              </div>
            `;
          }
        )
        .join("");

    host
      .querySelectorAll(
        ".course-player-module-button"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var module =
                button.closest(
                  ".course-player-module"
                );

              if (!module) {
                return;
              }

              var open =
                module.classList.toggle(
                  "is-open"
                );

              button.setAttribute(
                "aria-expanded",
                open
                  ? "true"
                  : "false"
              );
            }
          );
        }
      );

    host
      .querySelectorAll(
        "[data-live-lesson-index]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var index =
                Number(
                  button.dataset
                    .liveLessonIndex
                );

              if (
                !Number.isFinite(index) ||
                !canOpenLesson(index)
              ) {
                return;
              }

              state.currentIndex =
                index;

              renderCurriculum();

              renderCurrentLesson(true)
                .catch(
                  function (error) {
                    console.error(
                      "[LMS Course Player]",
                      error
                    );

                    showLessonRuntimeError(
                      error
                    );
                  }
                );
            }
          );
        }
      );
  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  function bindNavigation() {
    var prev =
      document.querySelector(
        "[data-course-prev]"
      );

    var next =
      document.querySelector(
        "[data-course-next]"
      );

    if (prev) {
      prev.onclick =
        function () {
          if (
            state.currentIndex > 0
          ) {
            state.currentIndex -= 1;

            renderCurriculum();

            renderCurrentLesson(true)
              .catch(
                showLessonRuntimeError
              );
          }
        };
    }

    if (next) {
      next.onclick =
        function () {
          handleNextAction()
            .catch(
              function (error) {
                console.error(
                  "[LMS Course Player]",
                  error
                );

                showLessonRuntimeError(
                  error
                );
              }
            );
        };
    }
  }


  async function handleNextAction() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    if (
      isLessonComplete(
        lesson.id
      )
    ) {
      if (
        state.currentIndex <
        state.lessons.length - 1
      ) {
        state.currentIndex += 1;

        renderCurriculum();

        await renderCurrentLesson(
          false
        );
      }

      return;
    }

    var interactive =
      interactiveForLesson(
        lesson
      );

    if (interactive) {
      window.location.href =
        interactive.url;

      return;
    }

    await completeCurrentLesson();
  }


  /* ============================================================
     CURRENT LESSON
     ============================================================ */

  async function renderCurrentLesson(
    scrollTop
  ) {
    if (state.renderingLesson) {
      return;
    }

    state.renderingLesson = true;

    try {
      if (!state.lessons.length) {
        setText(
          "[data-current-title]",
          "Course content is not available yet"
        );

        setText(
          "[data-current-intro]",
          "This course does not currently contain published learner lessons."
        );

        var emptyHost =
          ensureLessonContentHost();

        if (emptyHost) {
          emptyHost.innerHTML = "";
        }

        return;
      }

      state.currentIndex =
        Math.max(
          0,
          Math.min(
            state.currentIndex,
            state.lessons.length - 1
          )
        );

      var lesson =
        state.lessons[
          state.currentIndex
        ];

      var section =
        state.sections.find(
          function (row) {
            return (
              row.id ===
              lesson.section_id
            );
          }
        );

      setText(
        "[data-current-module]",
        section
          ? section.title ||
            "Module"
          : "Module"
      );

      setText(
        "[data-current-title]",
        lesson.title ||
        "Lesson"
      );

      setText(
        "[data-current-intro]",
        lesson.description ||
        "Review the lesson content below."
      );

      setText(
        "[data-current-note]",
        lesson.is_required === false
          ? "This lesson is optional."
          : "Complete this lesson to record your progress."
      );

      setText(
        "[data-current-lesson-label]",
        "Lesson " +
        (state.currentIndex + 1) +
        " · " +
        (lesson.title || "Lesson")
      );

      setText(
        "[data-current-lesson-count]",
        (state.currentIndex + 1) +
        " of " +
        state.lessons.length +
        " lessons"
      );

      await renderLessonBlocks(
        lesson
      );

      // Video lessons use a distraction-free player: the stage contains
      // the video only. Text lesson headings/intro return automatically
      // for lessons that do not contain video blocks.
      var currentBlocks =
        state.blocksByLesson.get(lesson.id) || [];
      var isVideoLesson = currentBlocks.some(function (block) {
        return String(block.block_type || "").trim().toLowerCase() === "video";
      });
      var lessonPanel = document.querySelector(".course-player-lesson-panel");
      if (lessonPanel) {
        lessonPanel.classList.toggle("is-video-lesson", isVideoLesson);
      }

      var prev =
        document.querySelector(
          "[data-course-prev]"
        );

      var next =
        document.querySelector(
          "[data-course-next]"
        );

      var nextLabel =
        document.querySelector(
          "[data-course-next-label]"
        );

      if (prev) {
        prev.disabled =
          state.currentIndex === 0;
      }

      var completed =
        isLessonComplete(
          lesson.id
        );

      var interactive =
        interactiveForLesson(
          lesson
        );

      if (next) {
        next.disabled = false;
      }

      if (nextLabel) {
        if (completed) {
          nextLabel.textContent =
            state.currentIndex ===
            state.lessons.length - 1
              ? "Course Complete"
              : "Continue";
        } else if (interactive) {
          nextLabel.textContent =
            interactive.label;
        } else {
          nextLabel.textContent =
            "Mark Lesson Complete";
        }
      }

      updateProgressSummary();

      updateCurrentLessonUrl(
        lesson
      );

      if (scrollTop) {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }

    } finally {
      state.renderingLesson = false;
    }
  }


  async function renderLessonBlocks(
    lesson
  ) {
    var host =
      ensureLessonContentHost();

    if (!host) {
      return;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (!blocks.length) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "This lesson does not have any published content blocks yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      '<div class="course-player-runtime-loading">Loading lesson content...</div>';

    var rendered = [];

    for (
      var index = 0;
      index < blocks.length;
      index += 1
    ) {
      rendered.push(
        await renderBlock(
          blocks[index],
          lesson
        )
      );
    }

    host.innerHTML =
      rendered.join("");

    bindBlockProgressTracking(host, lesson, blocks);
  }


  async function renderBlock(
    block,
    lesson
  ) {
    var type =
      String(
        block.block_type ||
        "text"
      )
        .trim()
        .toLowerCase();

    var title =
      block.title
        ? `<h3 class="course-player-block-title">${escapeHtml(block.title)}</h3>`
        : "";

    if (
      [
        "text",
        "article",
        "rich_text",
        "paragraph",
        "html"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-text">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    if (
      [
        "heading",
        "header"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-heading">
          <h3>${escapeHtml(block.content || block.title || "")}</h3>
        </section>
      `;
    }

    if (
      [
        "video"
      ].includes(type)
    ) {
      return await renderVideoBlock(
        block,
        title
      );
    }

    if (
      [
        "audio"
      ].includes(type)
    ) {
      return await renderAudioBlock(
        block,
        title
      );
    }

    if (
      [
        "image"
      ].includes(type)
    ) {
      return await renderImageBlock(
        block,
        title
      );
    }

    if (
      [
        "file",
        "document",
        "download",
        "pdf"
      ].includes(type)
    ) {
      return await renderFileBlock(
        block,
        title
      );
    }

    if (
      [
        "embed"
      ].includes(type)
    ) {
      var embedUrl =
        normalizedUrl(
          block.external_url
        );

      if (!embedUrl) {
        return unavailableBlock(
          block,
          "Embedded content is unavailable."
        );
      }

      var height =
        Math.max(
          220,
          Math.min(
            900,
            Number(
              block.settings
                ?.height ||
              460
            )
          )
        );

      return `
        <section class="course-player-block">
          ${title}
          <div class="course-player-embed-frame">
            <iframe
              src="${escapeAttribute(embedUrl)}"
              title="${escapeAttribute(block.title || "Embedded lesson content")}"
              height="${height}"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      [
        "link"
      ].includes(type)
    ) {
      var linkUrl =
        normalizedUrl(
          block.external_url
        );

      if (!linkUrl) {
        return unavailableBlock(
          block,
          "The resource link is unavailable."
        );
      }

      return `
        <section class="course-player-block course-player-resource-card">
          ${title}
          <p>${escapeHtml(block.content || "Open this lesson resource in a new tab.")}</p>
          <a
            class="course-player-runtime-button"
            href="${escapeAttribute(linkUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Resource
          </a>
        </section>
      `;
    }

    if (
      type === "quiz"
    ) {
      return renderQuizBlock(
        block,
        lesson
      );
    }

    if (
      [
        "assessment",
        "knowledge_check"
      ].includes(type)
    ) {
      return renderAssessmentBlock(
        block,
        lesson
      );
    }

    if (
      [
        "callout",
        "note"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-callout">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-block-text">
        ${title}
        <div class="course-player-rich-text">
          ${safeRichHtml(block.content || "")}
        </div>
      </section>
    `;
  }


  /* ============================================================
     MEDIA
     ============================================================ */

  async function renderVideoBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var provider =
      String(
        block.settings?.provider ||
        media?.provider ||
        ""
      )
        .toLowerCase();

    var source =
      block.external_url ||
      media?.playback_url ||
      media?.metadata?.embed_url ||
      media?.metadata?.original_url ||
      "";

    if (
      provider ===
      "cloudflare_stream"
    ) {
      var uid =
        block.settings
          ?.provider_video_id ||
        media
          ?.provider_video_id ||
        "";

      if (uid) {
        source =
          "https://iframe.videodelivery.net/" +
          encodeURIComponent(uid);
      }
    }

    if (
      provider === "youtube"
    ) {
      source =
        youtubeEmbedUrl(
          source ||
          media?.provider_video_id
        );
    }

    if (
      media &&
      media.storage_bucket &&
      media.storage_path &&
      provider ===
        "supabase_storage"
    ) {
      source =
        await signedMediaUrl(
          media
        );
    }

    source =
      normalizedUrl(
        source
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This video is unavailable."
      );
    }

    if (
      provider === "youtube" ||
      provider === "cloudflare_stream" ||
      looksEmbeddableVideoUrl(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <div class="course-player-video-frame">
            <iframe
              src="${escapeAttribute(source)}"
              title="${escapeAttribute(block.title || media?.title || "Lesson video")}"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      looksDirectVideoFile(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <video
            class="course-player-video-element"
            controls
            preload="metadata"
          >
            <source src="${escapeAttribute(source)}">
            Your browser does not support video playback.
          </video>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
        ${title}
        <p>Open the video resource in a new tab.</p>
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Video
        </a>
      </section>
    `;
  }


  async function renderAudioBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This audio file is unavailable."
      );
    }

    return `
      <section class="course-player-block">
        ${title}
        <audio
          class="course-player-audio-element"
          controls
          preload="metadata"
          src="${escapeAttribute(source)}"
        ></audio>
      </section>
    `;
  }


  async function renderImageBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This image is unavailable."
      );
    }

    return `
      <figure class="course-player-block course-player-image-block">
        ${title}
        <img
          src="${escapeAttribute(source)}"
          alt="${escapeAttribute(block.title || "Lesson image")}"
          loading="lazy"
        >
      </figure>
    `;
  }


  async function renderFileBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This file is unavailable."
      );
    }

    var label =
      block.title ||
      media?.title ||
      media?.original_filename ||
      "Download Resource";

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="file">
        ${title}
        ${
          block.content
            ? `<p>${escapeHtml(block.content)}</p>`
            : ""
        }
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(label)}
        </a>
      </section>
    `;
  }


  async function blockMediaUrl(
    block
  ) {
    if (
      block.external_url
    ) {
      return normalizedUrl(
        block.external_url
      );
    }

    if (
      !block.media_id
    ) {
      return "";
    }

    var media =
      state.mediaById.get(
        block.media_id
      );

    if (!media) {
      return "";
    }

    if (
      media.playback_url
    ) {
      return normalizedUrl(
        media.playback_url
      );
    }

    return await signedMediaUrl(
      media
    );
  }


  async function signedMediaUrl(
    media
  ) {
    if (
      !media ||
      !media.storage_bucket ||
      !media.storage_path
    ) {
      return "";
    }

    try {
      var result =
        await state.db
          .storage
          .from(
            media.storage_bucket
          )
          .createSignedUrl(
            media.storage_path,
            60 * 60
          );

      if (result.error) {
        throw result.error;
      }

      return (
        result.data?.signedUrl ||
        ""
      );

    } catch (error) {
      console.error(
        "[LMS Course Player] signed media",
        error
      );

      return "";
    }
  }


  /* ============================================================
     QUIZ / ASSESSMENT LINKS
     ============================================================ */

  function renderQuizBlock(
    block,
    lesson
  ) {
    var quiz =
      quizForBlock(
        block,
        lesson
      );

    if (!quiz) {
      return unavailableBlock(
        block,
        "This quiz is not available yet."
      );
    }

    var url =
      quizUrl(
        quiz,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Knowledge Check</span>
        <h3>${escapeHtml(block.title || quiz.title || "Quiz")}</h3>
        <p>${escapeHtml(quiz.description || block.content || "Complete this quiz to continue your training.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Start Quiz
        </a>
      </section>
    `;
  }


  function renderAssessmentBlock(
    block,
    lesson
  ) {
    var assessment =
      assessmentForBlock(
        block,
        lesson
      );

    if (!assessment) {
      return unavailableBlock(
        block,
        "This assessment is not available yet."
      );
    }

    var url =
      assessmentUrl(
        assessment,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Assessment</span>
        <h3>${escapeHtml(block.title || assessment.title || "Assessment")}</h3>
        <p>${escapeHtml(assessment.description || block.content || "Complete this assessment to continue.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Open Assessment
        </a>
      </section>
    `;
  }


  function quizForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.quiz_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.quizzesByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function assessmentForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.assessment_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.assessmentsByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function quizUrl(
    quiz,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "quiz",
      quiz.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-quiz.html?" +
      params.toString()
    );
  }


  function assessmentUrl(
    assessment,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "assessment",
      assessment.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-assessment.html?" +
      params.toString()
    );
  }


  function interactiveForLesson(
    lesson
  ) {
    if (!lesson) {
      return null;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    var assessmentBlock =
      blocks.find(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      );

    if (assessmentBlock) {
      var assessment =
        assessmentForBlock(
          assessmentBlock,
          lesson
        );

      if (assessment) {
        return {
          label:
            "Open Assessment",
          url:
            assessmentUrl(
              assessment,
              lesson
            )
        };
      }
    }

    var quizBlock =
      blocks.find(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      );

    if (quizBlock) {
      var quiz =
        quizForBlock(
          quizBlock,
          lesson
        );

      if (quiz) {
        return {
          label:
            "Start Quiz",
          url:
            quizUrl(
              quiz,
              lesson
            )
        };
      }
    }

    return null;
  }


  /* ============================================================
     COMPLETE LESSON
     ============================================================ */

  async function completeCurrentLesson() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    await saveLessonProgressRecord(
      lesson.id,
      100
    );

    await updateEnrollmentProgress();

    renderCurriculum();

    /*
      Completing a lesson and navigating to the next lesson are separate
      actions. This prevents the Continue button from awarding completion
      and skipping forward in the same click.
    */
    await renderCurrentLesson(false);
  }


  async function saveLessonProgressRecord(
    lessonId,
    percent
  ) {
    var lesson =
      state.lessons.find(
        function (row) {
          return (
            row.id ===
            lessonId
          );
        }
      );

    if (!lesson) {
      throw new Error(
        "The lesson is not part of this published course."
      );
    }

    var now =
      new Date().toISOString();

    var completed =
      Number(percent || 0) >= 100;

    var existing =
      state.progress.get(
        lesson.id
      );

    var payload = {
      enrollment_id:
        state.enrollment.id,

      lesson_id:
        lesson.id,

      progress_percent:
        completed
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                Number(percent || 0)
              )
            ),

      last_position_seconds:
        Number(
          existing
            ?.last_position_seconds ||
          0
        ),

      started_at:
        existing?.started_at ||
        now,

      completed_at:
        completed
          ? now
          : existing?.completed_at ||
            null,

      last_activity_at:
        now,

      updated_at:
        now
    };

    var result;

    if (
      existing &&
      existing.id
    ) {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .update(payload)
          .eq(
            "id",
            existing.id
          )
          .eq(
            "enrollment_id",
            state.enrollment.id
          )
          .select("*")
          .maybeSingle();

    } else {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .insert(payload)
          .select("*")
          .maybeSingle();
    }

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        existing && existing.id
          ? "Lesson progress could not be updated. The record may be blocked by the current Supabase policy or no longer exists."
          : "Lesson progress could not be created. Supabase did not return the new progress record."
      );
    }

    state.progress.set(
      lesson.id,
      result.data
    );

    return result.data;
  }


  async function updateEnrollmentProgress() {
    var rpcResult = await state.db.rpc(
      "lms_refresh_enrollment_progress",
      { p_enrollment_id: state.enrollment.id }
    );

    if (rpcResult.error) {
      throw rpcResult.error;
    }

    var enrollmentResult = await state.db
      .from(TABLES.enrollments)
      .select("*")
      .eq("id", state.enrollment.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (enrollmentResult.error) {
      throw enrollmentResult.error;
    }

    if (enrollmentResult.data) {
      state.enrollment = enrollmentResult.data;
    }

    updateProgressSummary();
    return Number(rpcResult.data || state.enrollment.progress_percent || 0);
  }


  async function saveBlockProgressRecord(blockId, percent) {
    var existing = state.blockProgress.get(blockId);
    var now = new Date().toISOString();
    var completed = Number(percent || 0) >= 100;
    var payload = {
      enrollment_id: state.enrollment.id,
      block_id: blockId,
      progress_percent: completed ? 100 : Math.max(0, Math.min(100, Number(percent || 0))),
      last_position_seconds: Number(existing?.last_position_seconds || 0),
      completed_at: completed ? (existing?.completed_at || now) : (existing?.completed_at || null),
      updated_at: now
    };

    var result;
    if (existing?.id) {
      result = await state.db.from(TABLES.blockProgress).update(payload)
        .eq("id", existing.id).eq("enrollment_id", state.enrollment.id)
        .select("*").maybeSingle();
    } else {
      result = await state.db.from(TABLES.blockProgress).insert(payload)
        .select("*").maybeSingle();
    }
    if (result.error) throw result.error;
    if (result.data) state.blockProgress.set(blockId, result.data);
    return result.data;
  }


  function bindBlockProgressTracking(host, lesson, blocks) {
    var byId = new Map(blocks.map(function (b) { return [b.id, b]; }));
    host.querySelectorAll("[data-lms-block-id]").forEach(function (node) {
      var blockId = node.getAttribute("data-lms-block-id");
      var block = byId.get(blockId);
      if (!block) return;

      var finish = async function () {
        try {
          await saveBlockProgressRecord(blockId, 100);
        } catch (error) {
          console.error("[LMS Course Player] block progress", error);
        }
      };

      node.querySelectorAll("a.course-player-runtime-button").forEach(function (link) {
        link.addEventListener("click", finish, { once: true });
      });

      node.querySelectorAll("video,audio").forEach(function (media) {
        media.addEventListener("ended", finish, { once: true });
      });
    });
  }

  /* ============================================================
     PLAYER API FOR QUIZ RUNTIME
     ============================================================ */

  function exposePlayerApi() {
    window.Screenings4uLMSPlayer = {
      saveLessonProgress:
        async function (
          lessonId,
          progressPercent
        ) {
          var saved =
            await saveLessonProgressRecord(
              lessonId,
              progressPercent == null
                ? 100
                : progressPercent
            );

          await updateEnrollmentProgress();

          renderCurriculum();

          return saved;
        },

      reloadProgress:
        async function () {
          await loadProgress();
          renderCurriculum();
          updateProgressSummary();
        },

      getEnrollmentId:
        function () {
          return state.enrollment?.id || "";
        },

      getCourseId:
        function () {
          return state.course?.id || "";
        }
    };
  }


  /* ============================================================
     COMPLETION / LOCKS
     ============================================================ */

  function firstIncompleteIndex() {
    var index =
      state.lessons.findIndex(
        function (lesson) {
          return !isLessonComplete(
            lesson.id
          );
        }
      );

    return index >= 0
      ? index
      : Math.max(
          0,
          state.lessons.length - 1
        );
  }


  function isLessonComplete(
    lessonId
  ) {
    var row =
      state.progress.get(
        lessonId
      );

    return !!(
      row &&
      (
        row.completed_at ||
        Number(
          row.progress_percent ||
          0
        ) >= 100
      )
    );
  }


  function canOpenLesson(
    index
  ) {
    if (
      index <= 0
    ) {
      return true;
    }

    var lesson =
      state.lessons[index];

    if (!lesson) {
      return false;
    }

    var courseRequiresOrder = !!(
      state.course &&
      (
        state.course.navigation_mode ===
          "sequential" ||
        state.course.require_all_required_lessons ===
          true
      )
    );

    var lessonRequiresPrevious =
      lesson.lock_until_previous_complete ===
      true;

    if (
      !courseRequiresOrder &&
      !lessonRequiresPrevious
    ) {
      return true;
    }

    /*
      A later lesson remains locked until every earlier required lesson is
      complete. Optional lessons never block the learner's path.
    */
    return state.lessons
      .slice(0, index)
      .every(
        function (previous) {
          return (
            previous.is_required === false ||
            isLessonComplete(
              previous.id
            )
          );
        }
      );
  }


  function updateProgressSummary() {
    var requiredLessons =
      state.lessons.filter(
        function (lesson) {
          return (
            lesson.is_required !==
            false
          );
        }
      );

    var targetLessons =
      requiredLessons.length
        ? requiredLessons
        : state.lessons;

    var completed =
      targetLessons.filter(
        function (lesson) {
          return isLessonComplete(
            lesson.id
          );
        }
      ).length;

    var progress =
      targetLessons.length
        ? Math.round(
            (
              completed /
              targetLessons.length
            ) *
            100
          )
        : Number(
            state.enrollment
              ?.progress_percent ||
            0
          );

    progress =
      Math.max(
        0,
        Math.min(
          100,
          progress
        )
      );

    setText(
      "[data-course-progress-text]",
      progress + "%"
    );

    var fill =
      document.querySelector(
        "[data-course-progress-fill]"
      );

    if (fill) {
      fill.style.width =
        progress + "%";
    }
  }


  /* ============================================================
     DOM HOST
     ============================================================ */

  function ensureLessonContentHost() {
    var existing =
      document.getElementById(
        "coursePlayerLessonBlocks"
      );

    if (existing) {
      return existing;
    }

    var inner =
      document.querySelector(
        ".course-player-content-inner"
      );

    if (!inner) {
      return null;
    }

    var host =
      document.createElement(
        "div"
      );

    host.id =
      "coursePlayerLessonBlocks";

    host.className =
      "course-player-runtime-blocks";

    var infoCard =
      inner.querySelector(
        ".course-player-info-card"
      );

    if (infoCard) {
      inner.insertBefore(
        host,
        infoCard
      );
    } else {
      inner.appendChild(
        host
      );
    }

    return host;
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function lessonMeta(
    lesson
  ) {
    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (
      blocks.some(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      )
    ) {
      return "Quiz";
    }

    if (
      blocks.some(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      )
    ) {
      return "Assessment";
    }

    var minutes =
      Number(
        lesson.estimated_minutes ||
        0
      );

    if (minutes > 0) {
      return (
        minutes +
        (
          minutes === 1
            ? " minute"
            : " minutes"
        )
      );
    }

    return (
      lesson.is_required === false
        ? "Optional lesson"
        : "Required lesson"
    );
  }


  function updateCurrentLessonUrl(
    lesson
  ) {
    var url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "course",
      state.course.id
    );

    url.searchParams.set(
      "enrollment",
      state.enrollment.id
    );

    url.searchParams.set(
      "lesson",
      lesson.id
    );

    history.replaceState(
      null,
      "",
      url.toString()
    );
  }


  function unavailableBlock(
    block,
    message
  ) {
    return `
      <section class="course-player-block course-player-runtime-empty">
        ${
          block.title
            ? `<strong>${escapeHtml(block.title)}</strong>`
            : ""
        }
        <span>${escapeHtml(message)}</span>
      </section>
    `;
  }


  function normalizedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    try {
      var url =
        new URL(
          raw,
          window.location.href
        );

      if (
        ![
          "http:",
          "https:"
        ].includes(
          url.protocol
        )
      ) {
        return "";
      }

      return url.href;

    } catch (_) {
      return "";
    }
  }


  function youtubeEmbedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    if (
      /^[A-Za-z0-9_-]{11}$/.test(
        raw
      )
    ) {
      return (
        "https://www.youtube.com/embed/" +
        raw
      );
    }

    try {
      var url =
        new URL(raw);

      if (
        url.hostname.includes(
          "youtu.be"
        )
      ) {
        var shortId =
          url.pathname
            .split("/")
            .filter(Boolean)[0];

        return shortId
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(shortId)
          : "";
      }

      if (
        url.hostname.includes(
          "youtube.com"
        )
      ) {
        if (
          url.pathname.startsWith(
            "/embed/"
          )
        ) {
          return url.href;
        }

        var id =
          url.searchParams.get(
            "v"
          );

        return id
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(id)
          : "";
      }

    } catch (_) {}

    return normalizedUrl(
      raw
    );
  }


  function looksDirectVideoFile(
    url
  ) {
    return /\.(mp4|webm|ogg)(?:$|[?#])/i
      .test(url);
  }


  function looksEmbeddableVideoUrl(
    url
  ) {
    return (
      /youtube\.com\/embed\//i.test(url) ||
      /iframe\.videodelivery\.net/i.test(url)
    );
  }


  function safeRichHtml(
    value
  ) {
    var html =
      String(
        value ||
        ""
      );

    if (!html) {
      return "";
    }

    var template =
      document.createElement(
        "template"
      );

    template.innerHTML =
      html;

    template.content
      .querySelectorAll(
        "script,style,object,embed,iframe,form,input,button,textarea,select"
      )
      .forEach(
        function (node) {
          node.remove();
        }
      );

    template.content
      .querySelectorAll("*")
      .forEach(
        function (node) {
          [
            ...node.attributes
          ].forEach(
            function (attribute) {
              var name =
                attribute.name
                  .toLowerCase();

              var value =
                String(
                  attribute.value ||
                  ""
                ).trim();

              if (
                name.startsWith(
                  "on"
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );

                return;
              }

              if (
                [
                  "href",
                  "src"
                ].includes(name) &&
                /^javascript:/i.test(
                  value
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );
              }
            }
          );

          if (
            node.tagName === "A"
          ) {
            node.setAttribute(
              "rel",
              "noopener noreferrer"
            );

            if (
              node.getAttribute(
                "target"
              ) === "_blank"
            ) {
              node.setAttribute(
                "rel",
                "noopener noreferrer"
              );
            }
          }
        }
      );

    return template.innerHTML;
  }


  function setText(
    selector,
    value
  ) {
    document
      .querySelectorAll(
        selector
      )
      .forEach(
        function (element) {
          element.textContent =
            value == null
              ? ""
              : String(value);
        }
      );
  }


  function escapeHtml(
    value
  ) {
    var div =
      document.createElement(
        "div"
      );

    div.textContent =
      String(
        value == null
          ? ""
          : value
      );

    return div.innerHTML;
  }


  function escapeAttribute(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      );
  }


  function showLessonRuntimeError(
    error
  ) {
    console.error(
      "[LMS Course Player]",
      error
    );

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML =
        '<div class="course-player-runtime-error">' +
          escapeHtml(
            error?.message ||
            "Unable to load this lesson."
          ) +
        "</div>";
    }
  }


  function showError(
    error
  ) {
    var title =
      document.querySelector(
        "[data-current-title]"
      );

    var intro =
      document.querySelector(
        "[data-current-intro]"
      );

    var note =
      document.querySelector(
        "[data-current-note]"
      );

    if (title) {
      title.textContent =
        "Unable to open this course";
    }

    if (intro) {
      intro.textContent =
        error &&
        error.message
          ? error.message
          : "Please return to My Courses and try again.";
    }

    if (note) {
      note.textContent =
        "Only published courses attached to your authenticated learner enrollment can be opened.";
    }

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML = "";
    }
  }


  /* ============================================================
     RUNTIME STYLES
     ============================================================ */

  function injectRuntimeStyles() {
    if (
      document.getElementById(
        "coursePlayerRuntimeStyles"
      )
    ) {
      return;
    }

    var style =
      document.createElement(
        "style"
      );

    style.id =
      "coursePlayerRuntimeStyles";

    style.textContent = `
      .course-player-runtime-blocks{
        display:grid;
        gap:20px;
        margin-top:28px;
      }

      .course-player-block{
        min-width:0;
      }

      .course-player-block-title{
        margin:0 0 12px;
        color:#172033;
        font-size:19px;
        line-height:1.35;
      }

      .course-player-rich-text{
        color:#344054;
        font-size:15px;
        line-height:1.75;
      }

      .course-player-rich-text > :first-child{
        margin-top:0;
      }

      .course-player-rich-text > :last-child{
        margin-bottom:0;
      }

      .course-player-rich-text img{
        max-width:100%;
        height:auto;
      }

      .course-player-video-frame,
      .course-player-embed-frame{
        position:relative;
        width:100%;
        overflow:hidden;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-video-frame{
        aspect-ratio:16/9;
      }

      .course-player-video-frame iframe,
      .course-player-embed-frame iframe{
        width:100%;
        height:100%;
        display:block;
        border:0;
      }

      .course-player-embed-frame iframe{
        min-height:300px;
        background:#fff;
      }

      .course-player-video-element,
      .course-player-audio-element{
        width:100%;
        display:block;
      }

      .course-player-video-element{
        max-height:560px;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-image-block{
        margin:0;
      }

      .course-player-image-block img{
        width:auto;
        max-width:100%;
        height:auto;
        display:block;
        border-radius:14px;
      }

      .course-player-resource-card,
      .course-player-interactive-card,
      .course-player-callout{
        padding:20px;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#f8fafc;
      }

      .course-player-resource-card p,
      .course-player-interactive-card p{
        margin:8px 0 16px;
        color:#687386;
        font-size:14px;
        line-height:1.65;
      }

      .course-player-interactive-card h3{
        margin:5px 0 0;
        color:#172033;
        font-size:20px;
      }

      .course-player-interactive-kicker{
        color:#ff6b00;
        font-size:10px;
        font-weight:850;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .course-player-runtime-button{
        min-height:42px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 15px;
        border:1px solid #325aa3;
        border-radius:9px;
        background:#325aa3;
        color:#fff;
        font-size:13px;
        font-weight:800;
        text-decoration:none;
      }

      .course-player-runtime-button:hover{
        border-color:#24467f;
        background:#24467f;
        color:#fff;
      }

      .course-player-runtime-empty,
      .course-player-runtime-loading,
      .course-player-runtime-error{
        padding:18px;
        border:1px dashed #d7dee8;
        border-radius:12px;
        color:#687386;
        font-size:13px;
        line-height:1.6;
      }

      .course-player-runtime-error{
        border-color:#efc7c4;
        background:#fff5f4;
        color:#b42318;
      }

      .course-player-runtime-empty strong,
      .course-player-runtime-empty span{
        display:block;
      }

      .course-player-lesson-link.is-locked{
        opacity:.52;
        cursor:not-allowed;
      }
    `;

    document.head.appendChild(
      style
    );
  }

})();


/* SOURCE: assets/js/lms-course-player-2026.js?v=20260915-2 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('lms-course-player-immersive');
    var toggle=document.querySelector('[data-curriculum-toggle]');
    var aside=document.querySelector('.course-player-sidebar');
    if(toggle&&aside){
      toggle.addEventListener('click',function(){
        var open=document.body.classList.toggle('course-curriculum-open');
        toggle.setAttribute('aria-expanded',open?'true':'false');
      });
      aside.addEventListener('click',function(e){
        if(window.innerWidth<=900 && e.target.closest('.course-player-lesson-link')){
          document.body.classList.remove('course-curriculum-open');
          toggle.setAttribute('aria-expanded','false');
        }
      });
      document.addEventListener('keydown',function(e){
        if(e.key==='Escape'){
          document.body.classList.remove('course-curriculum-open');
          toggle.setAttribute('aria-expanded','false');
        }
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
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
