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


/* SOURCE: assets/js/lms.js?v=20260830-2000 */
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


/* SOURCE: assets/js/lms-dashboard.js?v=20260903-1 */
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
/* SOURCE: assets/js/lms-dashboard.js */
/* ============================================================
   SCREENINGS4U LEARNING CENTER
   LEARNER DASHBOARD — LIVE SUPABASE DATA
   ============================================================ */

(function () {
  "use strict";

  function startDashboard() {
    initializeDashboard().catch(function (error) {
      console.error("[LMS Dashboard]", error);
      showDashboardError(error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startDashboard, { once: true });
  } else {
    startDashboard();
  }

  async function initializeDashboard() {
    if (!window.LMS || !window.LMS.ready) {
      throw new Error("Shared LMS authentication is unavailable.");
    }

    var state = await window.LMS.ready;
    var db = state.client;
    var user = state.user;
    var profile = state.profile || {};

    setGreeting(profile, user);

    var enrollmentResult = await db
      .from("lms_enrollments")
      .select(`
        id,
        user_id,
        course_id,
        status,
        progress_percent,
        enrolled_at,
        started_at,
        completed_at,
        last_activity_at,
        course:lms_courses(
          id,
          slug,
          title,
          short_description,
          description,
          status,
          certificate_enabled,
          thumbnail_media_id
        )
      `)
      .eq("user_id", user.id)
      .in("status", ["active", "completed"])
      .order("last_activity_at", { ascending: false, nullsFirst: false });

    if (enrollmentResult.error) {
      throw enrollmentResult.error;
    }

    var enrollments = enrollmentResult.data || [];

    /*
     * Render the customer's actual enrollment immediately.
     * Do not hold the entire dashboard behind course-image,
     * certificate, or lesson-progress requests.
     */
    renderContinueLearning(enrollments);
    renderCourseGrid(enrollments);

    document.body.classList.remove(
      "lms-dashboard-data-pending"
    );

    /*
     * Load secondary dashboard data in parallel.
     */
    var imagePromise =
      hydrateCourseImages(db, enrollments)
        .then(function () {
          /*
           * Re-render only after real thumbnail URLs have been hydrated.
           */
          renderContinueLearning(enrollments);
          renderCourseGrid(enrollments);
        })
        .catch(function (error) {
          console.warn(
            "[LMS Dashboard] Course image hydration failed:",
            error
          );
        });

    var certificatePromise = db
      .from("lms_certificates")
      .select(`
        id,
        enrollment_id,
        status,
        issued_at,
        certificate_number,
        enrollment:lms_enrollments!inner(user_id)
      `)
      .eq("enrollment.user_id", user.id)
      .eq("status", "issued");

    var lessonProgressPromise = db
      .from("lms_lesson_progress")
      .select(`
        id,
        enrollment_id,
        lesson_id,
        progress_percent,
        started_at,
        completed_at,
        last_activity_at,
        lesson:lms_lessons(
          id,
          title,
          section:lms_sections(
            id,
            course_id,
            title
          )
        )
      `)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(20);

    var secondaryResults =
      await Promise.all([
        certificatePromise,
        lessonProgressPromise,
        imagePromise
      ]);

    var certificateResult =
      secondaryResults[0] || {};

    var lessonProgressResult =
      secondaryResults[1] || {};

    if (certificateResult.error) {
      console.warn(
        "[LMS Dashboard] Certificates could not be loaded:",
        certificateResult.error
      );
    }

    if (lessonProgressResult.error) {
      console.warn(
        "[LMS Dashboard] Lesson activity could not be loaded:",
        lessonProgressResult.error
      );
    }

    renderStats(
      enrollments,
      certificateResult.data || [],
      lessonProgressResult.data || []
    );

    renderRecentActivity(
      enrollments,
      lessonProgressResult.data || []
    );
  }

  async function hydrateCourseImages(db, enrollments) {
    var mediaIds = Array.from(new Set(
      enrollments
        .map(function (enrollment) {
          return enrollment.course && enrollment.course.thumbnail_media_id;
        })
        .filter(Boolean)
    ));

    if (!mediaIds.length) return;

    var mediaResult = await db
      .from("lms_media")
      .select("id,storage_bucket,storage_path,thumbnail_url,playback_url")
      .in("id", mediaIds);

    if (mediaResult.error) {
      console.warn("[LMS Dashboard] Course images could not be loaded:", mediaResult.error);
      return;
    }

    var urls = new Map();
    await Promise.all((mediaResult.data || []).map(async function (media) {
      var directUrl = media.thumbnail_url || media.playback_url || "";
      if (directUrl) {
        urls.set(media.id, directUrl);
        return;
      }

      if (!media.storage_bucket || !media.storage_path) return;
      var signed = await db.storage
        .from(media.storage_bucket)
        .createSignedUrl(media.storage_path, 3600);

      if (signed.error) {
        console.warn("[LMS Dashboard] Signed course image URL failed:", signed.error);
        return;
      }

      urls.set(media.id, signed.data && signed.data.signedUrl || "");
    }));

    enrollments.forEach(function (enrollment) {
      if (!enrollment.course) return;
      enrollment.course.thumbnail_url =
        urls.get(enrollment.course.thumbnail_media_id) || "";
    });
  }

  function setGreeting(profile, user) {
    var name =
      profile.display_name ||
      profile.first_name ||
      (user.email ? user.email.split("@")[0] : "");

    var first =
      profile.first_name ||
      String(name || "").trim().split(/\s+/)[0] ||
      "";

    var title = document.querySelector(".lms-page-title");
    if (title) {
      title.textContent =
        greetingForHour(new Date().getHours()) + ", " + first + ".";
    }
  }

  function greetingForHour(hour) {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function renderContinueLearning(enrollments) {
    var card = document.querySelector(".lms-continue-card");
    if (!card) return;

    var active = enrollments.find(function (e) {
      return (
        e.status === "active" &&
        Number(e.progress_percent || 0) > 0
      );
    }) || enrollments.find(function (e) {
      return e.status === "active";
    });

    if (!active || !active.course) {
      card.hidden = true;
      return;
    }

    card.hidden = false;

    var progress = clampPercent(active.progress_percent);
    var course = active.course;

    var title = card.querySelector(".lms-continue-title");
    var desc = card.querySelector(".lms-continue-description");
    var progressStrong = card.querySelector(".lms-progress-meta strong");
    var fill = card.querySelector(".lms-progress-fill");
    var resume = card.querySelector(".lms-continue-actions .lms-button");
    var details = card.querySelector(
      ".lms-continue-actions .lms-button-secondary"
    );
    if (title) {
      title.textContent =
        course.title || "";
    }

    if (desc) {
      desc.textContent =
        course.short_description ||
        course.description ||
        "";
    }

    if (progressStrong) {
      progressStrong.textContent =
        progress + "% Complete";
    }

    if (fill) {
      fill.style.width =
        progress + "%";
    }

    if (resume) {
      resume.href =
        "lms-course-player.html?course=" +
        encodeURIComponent(course.id) +
        "&enrollment=" +
        encodeURIComponent(active.id);
    }

    if (details) {
      details.href =
        "lms-course-details.html?course=" +
        encodeURIComponent(course.id);
    }

    var visual = card.querySelector(".lms-course-visual");

    if (visual) {
      if (course.thumbnail_url) {
        visual.style.backgroundImage =
          "url(\"" +
          String(course.thumbnail_url).replace(/\"/g, "%22") +
          "\")";

        visual.setAttribute(
          "aria-label",
          (course.title || "Training course") + " cover image"
        );
      } else {
        visual.style.backgroundImage = "none";
        visual.removeAttribute("aria-label");
      }
    }
  }

  function renderCourseGrid(enrollments) {
    var grid = document.querySelector(".lms-course-grid");
    if (!grid) return;

    var active = enrollments
      .filter(function (e) {
        return e.course;
      })
      .slice(0, 3);

    if (!active.length) {
      grid.innerHTML = "";
      var section = grid.closest(".lms-section");
      if (section) section.hidden = true;
      return;
    }

    var section = grid.closest(".lms-section");
    if (section) section.hidden = false;

    grid.innerHTML = active
      .map(function (e, index) {
        var progress = clampPercent(e.progress_percent);
        var course = e.course;
        var coverClass = [
          "lms-course-cover-one",
          "lms-course-cover-two",
          "lms-course-cover-three"
        ][index % 3];

        return `
          <a
            href="lms-course-details.html?course=${encodeURIComponent(course.id)}"
            class="lms-course-card"
          >
            <div class="lms-course-cover ${coverClass}"${course.thumbnail_url ? ` style="background-image:url('${escapeHtml(course.thumbnail_url)}');background-size:cover;background-position:center"` : ""}>
              <div class="lms-course-cover-icon"${course.thumbnail_url ? ' style="display:none"' : ""}>▶</div>
            </div>

            <div class="lms-course-body">
              <div class="lms-course-category">
                ${escapeHtml(e.status === "completed" ? "Completed" : "In Progress")}
              </div>

              <h3 class="lms-course-title">
                ${escapeHtml(course.title || "")}
              </h3>

              <div class="lms-course-meta">
                ${escapeHtml(course.short_description || statusText(e.status))}
              </div>

              <div class="lms-course-card-footer">
                <div class="lms-mini-progress">
                  <div class="lms-mini-progress-track">
                    <div
                      class="lms-mini-progress-fill"
                      style="width:${progress}%;"
                    ></div>
                  </div>
                </div>
                <span class="lms-progress-number">${progress}%</span>
              </div>
            </div>
          </a>
        `;
      })
      .join("");
  }

  function renderStats(enrollments, certificates, lessonProgress) {
    var values = document.querySelectorAll(".lms-stat-value");

    var inProgress = enrollments.filter(function (e) {
      return e.status === "active";
    }).length;

    var learningMinutes = lessonProgress.reduce(function (total, row) {
      if (!row.started_at || !row.completed_at) return total;

      var start = new Date(row.started_at).getTime();
      var end = new Date(row.completed_at).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return total;
      }

      return total + Math.min((end - start) / 60000, 480);
    }, 0);

    var hours = Math.round((learningMinutes / 60) * 10) / 10;

    if (values[0]) values[0].textContent = String(inProgress);
    if (values[1]) values[1].textContent = String(hours);
    if (values[2]) values[2].textContent = String(certificates.length);
  }

  function renderRecentActivity(enrollments, lessonProgress) {
    var list = document.querySelector(".lms-activity-list");
    if (!list) return;

    var enrollmentIds = new Set(
      enrollments.map(function (e) {
        return e.id;
      })
    );

    var rows = lessonProgress
      .filter(function (row) {
        return enrollmentIds.has(row.enrollment_id);
      })
      .slice(0, 5);

    if (!rows.length) {
      list.innerHTML = "";
      var widget = list.closest(".lms-widget");
      if (widget) widget.hidden = true;
      return;
    }

    var widget = list.closest(".lms-widget");
    if (widget) widget.hidden = false;

    list.innerHTML = rows
      .map(function (row) {
        var completed = Boolean(row.completed_at);
        var title =
          row.lesson && row.lesson.title
            ? row.lesson.title
            : "Lesson";

        return `
          <div class="lms-activity-item">
            <span class="lms-activity-marker ${completed ? "complete" : ""}"></span>
            <div>
              <p class="lms-activity-title">
                ${completed ? "Completed" : "Continued"} ${escapeHtml(title)}
              </p>
              <div class="lms-activity-time">
                ${escapeHtml(relativeDate(row.last_activity_at || row.completed_at || row.started_at))}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function clampPercent(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) n = 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function relativeDate(value) {
    if (!value) return "Recently";

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric"
    }).format(date);
  }

  function statusText(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
  }

  function showDashboardError(error) {
    document.body.classList.remove("lms-dashboard-data-pending");

    var content = document.querySelector(".lms-content");
    if (!content) return;

    var panel = document.createElement("div");
    panel.className = "lms-widget";
    panel.style.marginBottom = "18px";
    panel.innerHTML =
      "<strong>Unable to load learning data.</strong>" +
      "<p class='lms-section-subtitle' style='margin-top:6px;'>" +
      escapeHtml(error && error.message ? error.message : "Please refresh and try again.") +
      "</p>";

    content.insertBefore(panel, content.firstChild);
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

(function(){
  async function applyHeroAvatar(){
    try{
      if(!window.LMS || !window.LMS.ready) return;
      const ctx=await window.LMS.ready;
      const profile=ctx.profile||{};
      const path=profile.avatar_path;
      if(!path) return;
      let url=path;
      if(!/^https?:\/\//i.test(path)){
        const bucket=window.S4U_AVATAR_BUCKET||"avatars";
        const result=await ctx.client.storage.from(bucket).createSignedUrl(path,3600);
        if(result.error) throw result.error;
        url=result && result.data ? result.data.signedUrl : "";
      }
      if(!url) return;
      const wrap=document.querySelector('[data-lms-hero-avatar]');
      const img=document.querySelector('[data-lms-hero-avatar-image]');
      if(!wrap||!img) return;
      img.onload=function(){img.hidden=false;wrap.classList.add('has-photo');};
      img.src=url;
    }catch(e){console.warn('[LMS Dashboard] Profile photo could not be loaded:',e);}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyHeroAvatar,{once:true}); else applyHeroAvatar();
})();

;


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


/* SOURCE: inline script */

(function(){
  async function applyHeroAvatar(){
    try{
      if(!window.LMS || !window.LMS.ready) return;
      const ctx=await window.LMS.ready;
      let profile=ctx.profile||{};
      try {
        const fresh=await ctx.client.from("user_profiles").select("avatar_path").eq("id",ctx.user.id).maybeSingle();
        if(!fresh.error && fresh.data) profile=Object.assign({},profile,fresh.data);
      } catch(_) {}
      const path=profile.avatar_path;
      const fallback=document.querySelector('[data-lms-hero-avatar-fallback]');
      if(!path){ if(fallback) fallback.hidden=false; return; }
      let url=path;
      if(!/^https?:\/\//i.test(path)){
        const bucket=window.S4U_AVATAR_BUCKET||"avatars";
        const result=await ctx.client.storage.from(bucket).createSignedUrl(path,3600);
        if(result.error) throw result.error;
        url=result && result.data ? result.data.signedUrl : "";
      }
      if(!url) return;
      const wrap=document.querySelector('[data-lms-hero-avatar]');
      const img=document.querySelector('[data-lms-hero-avatar-image]');
      if(!wrap||!img) return;
      img.onload=function(){img.hidden=false;if(fallback)fallback.hidden=true;wrap.classList.add('has-photo');};
      img.onerror=function(){img.hidden=true;if(fallback)fallback.hidden=false;wrap.classList.remove('has-photo');};
      img.src=url+(url.includes('?')?'&':'?')+'v='+Date.now();
    }catch(e){console.warn('[LMS Dashboard] Profile photo could not be loaded:',e);}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyHeroAvatar,{once:true}); else applyHeroAvatar();
})();


/* SOURCE: assets/js/lms-dashboard-2026.js?v=20260915-2 */
// Screenings4u Learning Center — Dashboard 2026 UI
(() => {
  "use strict";
  const body = document.body;
  if (!body) return;
  body.classList.add("s4u-2026-page", "s4u-2026-lms-dashboard");

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
