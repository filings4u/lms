(() => {
  "use strict";

  const LOGIN_URL = "https://lms.screenings4u.com/training-login.html";
  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  let signingOut = false;

  async function safeSignOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      if (window.S4UAuth && typeof window.S4UAuth.signOutSilently === "function") {
        await window.S4UAuth.signOutSilently();
      } else if (window.supabase && typeof window.supabase.createClient === "function") {
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage: window.sessionStorage,
            storageKey: "s4u-training-auth-session"
          }
        });
        await client.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      console.warn("[LMS] Sign out cleanup warning:", error);
    } finally {
      try { sessionStorage.removeItem("s4u-training-auth-session"); } catch (_) {}
      try {
        Object.keys(sessionStorage).forEach((key) => {
          if (/supabase|training-auth|s4u-training/i.test(key)) sessionStorage.removeItem(key);
        });
      } catch (_) {}
      window.location.replace(LOGIN_URL);
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target && event.target.closest
      ? event.target.closest("#logout, .signout, [data-lms-signout]")
      : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    void safeSignOut();
  }, true);

  window.S4ULmsSignOut = safeSignOut;
})();
