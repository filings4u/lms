(() => {
  "use strict";

  const FONT_KEY = "s4u_lms_font_size";
  const FONT_DEFAULT = 14;
  const FONT_MIN = 12;
  const FONT_MAX = 18;

  function readFontSize(){
    const n = Number(localStorage.getItem(FONT_KEY));
    return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : FONT_DEFAULT;
  }

  function applyFontSize(n){
    const value = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(n) || FONT_DEFAULT));
    document.documentElement.style.setProperty("--portal-font-root", value + "px");
    localStorage.setItem(FONT_KEY, String(value));
    const el = document.getElementById("fontSizeValue");
    if (el) el.textContent = value === FONT_DEFAULT ? "Default" : String(value);
    return value;
  }

  let portalFontSize = applyFontSize(readFontSize());

  function closeMobileNav(){
    const mobile = document.getElementById("mobileNav");
    const menu = document.getElementById("menu");
    mobile?.classList.remove("open");
    document.body.classList.remove("mobile-nav-open");
    menu?.setAttribute("aria-expanded","false");
    mobile?.setAttribute("aria-hidden","true");
  }

  function bindShell(){
    document.getElementById("fontDown")?.addEventListener("click", () => {
      portalFontSize = applyFontSize(portalFontSize - 1);
    });
    document.getElementById("fontUp")?.addEventListener("click", () => {
      portalFontSize = applyFontSize(portalFontSize + 1);
    });
    document.getElementById("fontSizeValue")?.addEventListener("click", () => {
      portalFontSize = applyFontSize(FONT_DEFAULT);
    });

    const menu = document.getElementById("menu");
    const mobile = document.getElementById("mobileNav");

    menu?.addEventListener("click", () => {
      const open = !mobile?.classList.contains("open");
      mobile?.classList.toggle("open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      menu.setAttribute("aria-expanded", String(open));
      mobile?.setAttribute("aria-hidden", String(!open));
    });

    mobile?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMobileNav));

    document.getElementById("logout")?.addEventListener("click", async () => {
      const client = window.screenings4uSupabase || window.supabaseClient;
      try { await client?.auth?.signOut(); } catch (_) {}
      window.location.replace("training-login.html");
    });
  }

  function startClock(){
    const update = () => {
      const now = new Date();
      const d = document.getElementById("portalClockDate");
      const t = document.getElementById("portalClockTime");
      if (d) d.textContent = new Intl.DateTimeFormat("en-US", {
        weekday:"short", month:"short", day:"numeric", year:"numeric"
      }).format(now);
      if (t) t.textContent = new Intl.DateTimeFormat("en-US", {
        hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true
      }).format(now);
    };
    update();
    window.__s4uScheduleClock = setInterval(update, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindShell();
    startClock();
  });
})();