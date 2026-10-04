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


/* SOURCE: assets/js/lms.js?v=20260830-2345 */
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


/* SOURCE: assets/js/lms-course-library-redesign-2026.js?v=20260915-2 */
/* screenings4u LMS — Complete Published Course Library */
(function(){
  "use strict";

  let db;
  let courses=[];
  const productByCourse=new Map();

  document.addEventListener("DOMContentLoaded",()=>init().catch(showError));

  async function init(){
    if(!window.LMS?.ready) throw new Error("Shared LMS authentication is unavailable.");
    ({client:db}=await window.LMS.ready);

    const courseResult=await db
      .from("lms_courses")
      .select("*")
      .eq("status","published")
      .order("published_at",{ascending:false});
    if(courseResult.error) throw courseResult.error;
    courses=courseResult.data||[];

    await loadCatalogProducts();

    populateCategories();
    bindControls();
    render();
    document.getElementById("coursesLoading")?.setAttribute("hidden","");
  }

  async function loadCatalogProducts(){
    if(!courses.length) return;
    try{
      const productResult=await db
        .from("lms_training_products")
        .select("id,course_id,name,product_kind,active,metadata")
        .in("course_id",courses.map(c=>c.id))
        .eq("active",true)
        .eq("product_kind","course");
      if(productResult.error||!productResult.data?.length) return;

      const products=productResult.data;
      const priceResult=await db
        .from("lms_training_prices")
        .select("product_id,amount,currency,active,effective_from")
        .in("product_id",products.map(p=>p.id))
        .eq("active",true);
      const prices=priceResult.error?[]:(priceResult.data||[]);

      products.forEach(product=>{
        const productPrices=prices
          .filter(p=>p.product_id===product.id)
          .sort((a,b)=>new Date(b.effective_from||0)-new Date(a.effective_from||0));
        productByCourse.set(product.course_id,{...product,price:productPrices[0]||null});
      });
    }catch(error){
      console.warn("[LMS Course Library] Product details were unavailable.",error);
    }
  }

  function categoryFor(course){
    const product=productByCourse.get(course.id);
    const fromProduct=product?.metadata?.category;
    if(fromProduct) return String(fromProduct);
    const title=String(course.title||"").toLowerCase();
    if(title.includes("dot")||title.includes("specimen collector")) return "DOT Specimen Collector Training";
    return "Professional Training";
  }

  function detailUrl(course){
    return "lms-course-details.html?course="+encodeURIComponent(course.id);
  }

  function catalogState(){
    return {label:"Available",className:"",action:"View Course"};
  }

  function plainText(value){
    const html=String(value||"");
    const el=document.createElement("div");
    el.innerHTML=html;
    return (el.textContent||el.innerText||"").replace(/\s+/g," ").trim();
  }

  function descriptionFor(course){
    const text=plainText(course.short_description||course.description||"");
    return text||"Open the course to review training details, requirements, and learning objectives.";
  }

  function formatPrice(course){
    const price=productByCourse.get(course.id)?.price;
    if(!price||price.amount==null) return null;
    const currency=String(price.currency||"usd").toUpperCase();
    try{
      return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(Number(price.amount));
    }catch(_){
      return "$"+Number(price.amount).toFixed(2);
    }
  }

  function populateCategories(){
    const select=document.getElementById("courseCategory");
    if(!select) return;
    const categories=[...new Set(courses.map(categoryFor))].filter(Boolean).sort();
    select.innerHTML='<option value="all">All Categories</option>'+categories.map(category=>
      '<option value="'+escapeHtml(category)+'">'+escapeHtml(category)+'</option>'
    ).join("");
  }

  function bindControls(){
    document.getElementById("courseSearch")?.addEventListener("input",render);
    document.getElementById("courseCategory")?.addEventListener("change",render);
    document.getElementById("courseSort")?.addEventListener("change",render);
    document.getElementById("coursesClearFilters")?.addEventListener("click",()=>{
      document.getElementById("courseSearch").value="";
      document.getElementById("courseCategory").value="all";
      document.getElementById("courseSort").value="newest";
      render();
    });
  }

  function render(){
    const search=(document.getElementById("courseSearch")?.value||"").trim().toLowerCase();
    const category=document.getElementById("courseCategory")?.value||"all";
    const sort=document.getElementById("courseSort")?.value||"newest";

    const filtered=courses.filter(course=>{
      const cat=categoryFor(course);
      const haystack=[course.title,course.short_description,plainText(course.description),cat].join(" ").toLowerCase();
      return (category==="all"||cat===category)&&(!search||haystack.includes(search));
    });

    filtered.sort((a,b)=>{
      if(sort==="title-asc") return String(a.title||"").localeCompare(String(b.title||""));
      if(sort==="title-desc") return String(b.title||"").localeCompare(String(a.title||""));
      return new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0);
    });

    const grid=document.getElementById("coursesGrid");
    if(grid) grid.innerHTML=filtered.map(renderCard).join("");

    const allCount=courses.length;
    const categoryCount=new Set(courses.map(categoryFor)).size;
    const selfPacedCount=courses.filter(course=>String(course.pace||"").toLowerCase()==="self_paced").length;
    setText("availableCourseCount",allCount);
    setText("catalogCourseCount",allCount);
    setText("catalogCategoryCount",categoryCount);
    setText("catalogSelfPacedCount",selfPacedCount);
    setText("coursesResultsCount",filtered.length+" course"+(filtered.length===1?"":"s"));

    const empty=document.getElementById("coursesEmpty");
    if(empty) empty.hidden=filtered.length!==0;
  }

  function renderCard(course){
    const state=catalogState();
    const product=productByCourse.get(course.id);
    const price=formatPrice(course);
    const pace=String(course.pace||"").toLowerCase()==="self_paced"?"Self-paced":"Instructor-led";
    const accessText=product?.metadata?.results||((course.time_limit_days?String(course.time_limit_days)+"-day access":"Course access"));

    return `
      <article class="course-card">
        <div class="course-card-visual" aria-hidden="true">
          <span class="course-card-icon">
            <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path><path d="M4 5.5v16"></path><path d="M8 8h8"></path><path d="M8 12h6"></path></svg>
          </span>
        </div>
        <div class="course-card-body">
          <div class="course-card-topline">
            <span class="course-card-category">${escapeHtml(categoryFor(course))}</span>
            <span class="course-card-state ${state.className}">${escapeHtml(state.label)}</span>
          </div>
          <h3 class="course-card-title">${escapeHtml(course.title||"Untitled Course")}</h3>
          <p class="course-card-description">${escapeHtml(descriptionFor(course))}</p>
          <div class="course-card-meta">
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path></svg>${escapeHtml(pace)}</span>
            <span><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path><path d="M4 5.5v16"></path></svg>${escapeHtml(accessText)}</span>
          </div>
          <div class="course-card-footer">
            <span class="course-card-price ${price?'':'muted'}">${escapeHtml(price||"View course details")}</span>
            <a class="course-card-action" href="${detailUrl(course)}">${escapeHtml(state.action)}<svg viewBox="0 0 24 24"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></a>
          </div>
        </div>
      </article>`;
  }

  function setText(id,value){
    const el=document.getElementById(id);
    if(el) el.textContent=String(value);
  }

  function escapeHtml(value){
    return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function showError(error){
    console.error("[LMS Course Library]",error);
    document.getElementById("coursesLoading")?.setAttribute("hidden","");
    const grid=document.getElementById("coursesGrid");
    if(grid) grid.innerHTML='<div class="courses-empty" style="grid-column:1/-1"><h3>Unable to load the course library</h3><p>'+escapeHtml(error?.message||"Please refresh the page and try again.")+'</p></div>';
    setText("coursesResultsCount","Unable to load");
  }
})();


/* SOURCE: assets/js/lms-global-support-bar.js?v=20260915-1 */
/* Screenings4u Learning Center — shared support bar
   Adds the same full-width support bar to every LMS page except the course player. */
(function () {
  'use strict';

  var page = (window.location.pathname.split('/').pop() || '').split('?')[0].split('#')[0].toLowerCase();
  if (page === 'lms-course-player.html') return;

  function installStyles() {
    if (document.getElementById('s4u-global-support-bar-styles')) return;
    var style = document.createElement('style');
    style.id = 's4u-global-support-bar-styles';
    style.textContent = `
      .s4u-global-support-bar{
        box-sizing:border-box;
        width:100%;
        grid-column:1 / -1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:24px;
        margin:22px 0 0;
        padding:20px 22px;
        border-radius:16px;
        background:#294f89;
        color:#fff;
        box-shadow:none;
      }
      .s4u-global-support-bar__copy{min-width:0}
      .s4u-global-support-bar__copy h2{
        margin:0 0 5px;
        color:#fff;
        font-size:17px;
        line-height:1.2;
        font-weight:800;
        letter-spacing:-.015em;
      }
      .s4u-global-support-bar__copy p{
        margin:0;
        color:rgba(255,255,255,.88);
        font-size:12px;
        line-height:1.5;
      }
      .s4u-global-support-bar__button{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        padding:0 20px;
        border-radius:10px;
        background:#ff6b00;
        color:#fff !important;
        font-size:12px;
        font-weight:800;
        text-decoration:none !important;
        white-space:nowrap;
        transition:background .15s ease,transform .15s ease;
      }
      .s4u-global-support-bar__button:hover{background:#e66000;transform:translateY(-1px)}
      .s4u-global-support-bar__button:focus-visible{outline:3px solid rgba(255,255,255,.45);outline-offset:3px}
      @media (max-width:700px){
        .s4u-global-support-bar{align-items:flex-start;flex-direction:column;padding:18px;margin-top:18px}
        .s4u-global-support-bar__button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function removePageSpecificSupportBars() {
    document.querySelectorAll('.orders-support-card').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.danger-card').forEach(function (el) {
      var text = (el.textContent || '').toLowerCase();
      if (text.includes('contact support') || text.includes('need help with your account')) el.remove();
    });
  }

  function getTarget() {
    return document.querySelector('.lms-content') ||
      document.querySelector('.lms-support-content') ||
      document.querySelector('.lms-notifications-content') ||
      document.querySelector('.onboard-wrap') ||
      document.querySelector('.lms-main');
  }

  function inject() {
    if (document.querySelector('.s4u-global-support-bar')) return;
    var target = getTarget();
    if (!target) return;

    installStyles();
    removePageSpecificSupportBars();

    var bar = document.createElement('section');
    bar.className = 's4u-global-support-bar';
    bar.setAttribute('aria-label', 'Training support');
    bar.innerHTML = `
      <div class="s4u-global-support-bar__copy">
        <h2>Need help with your training?</h2>
        <p>Contact Screenings4u support for course access, certificates, appointments, account questions, or training assistance.</p>
      </div>
      <a class="s4u-global-support-bar__button" href="lms-support.html">Contact Support</a>
    `;
    target.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
