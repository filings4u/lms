(() => {
  "use strict";

  const BUILD = "20261004-training3";
  console.info(`[LMS My Appointments] build ${BUILD}`);

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: "s4u-training-auth-session"
    }
  });

  const FONT_KEY = "s4u_lms_font_size";
  const FONT_DEFAULT = 14;
  const FONT_MIN = 12;
  const FONT_MAX = 18;
  const navItems = [
    ["lms-dashboard.html", "Dashboard", "⌂"],
    ["lms-my-courses.html", "My Courses", "▶"],
    ["lms-courses.html", "Course Library", "▦"],
    ["lms-progress.html", "Progress", "◉"],
    ["lms-certificates.html", "Certificates", "✓"],
    ["lms-live-training.html", "Live Training", "●"],
    ["lms-my-appointments.html", "Appointments", "◷"],
    ["lms-group-seats.html", "Group Seats", "♙"],
    ["lms-documents.html", "Documents", "▤"],
    ["lms-orders.html", "Orders", "≡"],
    ["lms-notifications.html", "Notifications", "✉"],
    ["lms-account.html", "Account", "○"],
    ["lms-support.html", "Support", "?"]
  ];

  const state = { appointments: [], services: [], filter: "upcoming" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {weekday:"short", month:"short", day:"numeric", year:"numeric"}).format(d);
  };
  const fmtTime = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {hour:"numeric", minute:"2-digit"}).format(d);
  };
  const fmtMonth = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {month:"short"}).format(d).toUpperCase();
  };
  const fmtDay = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {day:"2-digit"}).format(d);
  };
  const norm = value => String(value || "").trim().toLowerCase();
  const isClosed = a => ["cancelled", "completed", "no_show"].includes(norm(a.status));
  const isUpcoming = a => !isClosed(a) && new Date(a.end_at || a.start_at).getTime() + 3600000 > Date.now();
  const serviceFor = a => state.services.find(s => String(s.id) === String(a.event_type_id));
  const displayTitle = a => serviceFor(a)?.name || a.title || "";
  const statusLabel = a => String(a.status || "").replace(/_/g, " ");
  const statusClass = value => /completed|confirmed|scheduled|active/i.test(String(value || "")) ? "good" : /cancelled|no show|no_show/i.test(String(value || "")) ? "bad" : "warn";

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

  function renderShell(){
    const links = navItems.map(([href,label,icon]) => `<a href="${href}"${href === "lms-my-appointments.html" ? ' class="active" aria-current="page"' : ""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
    document.getElementById("trainingPortalApp").innerHTML = `
      <div class="app">
        <aside class="side" id="side">
          <div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div>
          <nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav>
          <div class="side-foot"><div style="font-size:.5625rem;color:#9fb3c7">Portal</div><div style="font-size:.6875rem;font-weight:800;color:#fff;margin-top:3px">lms.screenings4u.com</div></div>
        </aside>
        <main class="main">
          <header class="top">
            <div class="top-left">
              <button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button>
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">My Appointments</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Appointments</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>My Appointments</h1><p>View and manage your scheduled live training sessions.</p><div class="hero-actions"><a class="btn primary" href="lms-schedule-appointment.html">Schedule Appointment</a><a class="btn secondary" href="lms-live-training.html">Live Training</a></div></section>
            <section class="section" id="content"><div class="loading-msg">Loading appointments…</div></section>
          </div>
        </main>
      </div>`;
  }

  function startClock(){
    const update = () => {
      const now = new Date();
      document.getElementById("portalClockDate").textContent = new Intl.DateTimeFormat("en-US", {weekday:"short", month:"short", day:"numeric", year:"numeric"}).format(now);
      document.getElementById("portalClockTime").textContent = new Intl.DateTimeFormat("en-US", {hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true}).format(now);
    };
    update();
    window.__s4uLmsClock = setInterval(update, 1000);
  }

  function bindShell(){
    document.getElementById("fontDown")?.addEventListener("click", () => { portalFontSize = applyFontSize(portalFontSize - 1); });
    document.getElementById("fontUp")?.addEventListener("click", () => { portalFontSize = applyFontSize(portalFontSize + 1); });
    document.getElementById("fontSizeValue")?.addEventListener("click", () => { portalFontSize = applyFontSize(FONT_DEFAULT); });
    const menu = document.getElementById("menu");
    const mobile = document.getElementById("mobileNav");
    menu?.addEventListener("click", () => {
      const open = !mobile.classList.contains("open");
      mobile.classList.toggle("open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      menu.setAttribute("aria-expanded", String(open));
      mobile.setAttribute("aria-hidden", String(!open));
    });
    mobile?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      mobile.classList.remove("open");
      document.body.classList.remove("mobile-nav-open");
      menu?.setAttribute("aria-expanded", "false");
      mobile.setAttribute("aria-hidden", "true");
    }));
    document.getElementById("logout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      window.location.replace("https://lms.screenings4u.com/training-login.html");
    });
  }

  async function invoke(body){
    const {data,error} = await db.functions.invoke("scheduling-booking", {body});
    if (error){
      let message = error.message;
      try { message = (await error.context?.clone?.().json())?.error || message; } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  async function loadData(){
    const [{appointments = []}, {services = []}] = await Promise.all([
      invoke({action:"my_appointments"}),
      invoke({action:"services"})
    ]);
    state.appointments = appointments;
    state.services = services;
    renderContent();
  }

  function filteredAppointments(){
    const rows = [...state.appointments].sort((a,b) => new Date(a.start_at) - new Date(b.start_at));
    if (state.filter === "upcoming") return rows.filter(isUpcoming);
    if (state.filter === "past") return rows.filter(a => !isUpcoming(a));
    return rows;
  }

  function renderContent(){
    const upcoming = state.appointments.filter(isUpcoming);
    const completed = state.appointments.filter(a => norm(a.status) === "completed");
    const cancelled = state.appointments.filter(a => norm(a.status) === "cancelled");
    const next = [...upcoming].sort((a,b) => new Date(a.start_at) - new Date(b.start_at))[0];
    const rows = filteredAppointments();

    document.getElementById("content").innerHTML = `
      <div class="metrics">
        <article class="metric"><small>Upcoming</small><strong>${upcoming.length}</strong><span>Scheduled sessions</span></article>
        <article class="metric"><small>Completed</small><strong>${completed.length}</strong><span>Past sessions completed</span></article>
        <article class="metric"><small>Cancelled</small><strong>${cancelled.length}</strong><span>Cancelled appointments</span></article>
        <article class="metric"><small>Next Session</small><strong>${next ? esc(fmtDate(next.start_at).replace(/, \d{4}$/,"")) : "—"}</strong>${next ? `<span>${esc(fmtTime(next.start_at))}</span>` : ""}</article>
      </div>
      <div class="section panel">
        <div class="panel-head appointments-toolbar">
          <div><h2>Training Sessions</h2><p>Your live training appointments and session status.</p></div>
          <div class="appointments-tabs" role="group" aria-label="Filter appointments">
            <button class="appointments-tab ${state.filter === "upcoming" ? "active" : ""}" type="button" data-filter="upcoming">Upcoming</button>
            <button class="appointments-tab ${state.filter === "past" ? "active" : ""}" type="button" data-filter="past">Past</button>
            <button class="appointments-tab ${state.filter === "all" ? "active" : ""}" type="button" data-filter="all">All</button>
          </div>
        </div>
        <div class="appointments-grid" id="appointmentsGrid">${rows.length ? rows.map(renderAppointment).join("") : `<div class="empty">${state.filter === "upcoming" ? "No upcoming appointments." : state.filter === "past" ? "No past appointments." : "No appointments."}</div>`}</div>
      </div>`;

    document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      renderContent();
    }));
    document.querySelectorAll("[data-cancel-id]").forEach(btn => btn.addEventListener("click", cancelAppointment));
  }

  function renderAppointment(a){
    const svc = serviceFor(a);
    const upcoming = isUpcoming(a);
    const start = new Date(a.start_at);
    const end = new Date(a.end_at || a.start_at);
    const opens = start.getTime() - 30 * 60000;
    const joinWindow = upcoming && Date.now() >= opens && Date.now() <= end.getTime() + 3600000;
    const canReschedule = upcoming && svc?.allow_reschedule === true;
    const canCancel = upcoming && svc?.allow_cancel === true;
    const hasLiveMeeting = upcoming && a.meeting_provider === "microsoft_teams";
    const title = displayTitle(a);
    const host = a.host_name ? `<span>Instructor: ${esc(a.host_name)}</span>` : "";
    const tracking = a.tracking_number ? `<span>Tracking: ${esc(a.tracking_number)}</span>` : "";
    const provider = a.meeting_provider === "microsoft_teams" ? `<span class="appointment-provider">Microsoft Teams</span>` : "";
    const status = statusLabel(a);
    const classes = `appointment-card${upcoming ? "" : " is-past"}${norm(a.status) === "cancelled" ? " is-cancelled" : ""}`;
    const rescheduleUrl = `lms-reschedule-appointment.html?appointment=${encodeURIComponent(a.id)}`;
    return `<article class="${classes}">
      <div class="appointment-date"><strong>${esc(fmtDay(a.start_at))}</strong><span>${esc(fmtMonth(a.start_at))}</span></div>
      <div class="appointment-body">
        <div class="appointment-top"><div>${provider}${title ? `<h3 class="appointment-title">${esc(title)}</h3>` : ""}</div>${status ? `<span class="badge ${statusClass(status)}">${esc(status)}</span>` : ""}</div>
        <div class="appointment-meta"><span>${esc(fmtDate(a.start_at))}</span><span>${esc(fmtTime(a.start_at))}${a.end_at ? ` – ${esc(fmtTime(a.end_at))}` : ""}</span>${host}${tracking}</div>
        ${upcoming && !joinWindow && hasLiveMeeting ? `<span class="appointment-note">Live Training opens 30 minutes before the scheduled start time.</span>` : ""}
      </div>
      <div class="appointment-actions">
        ${hasLiveMeeting ? `<a class="btn ${joinWindow ? "primary" : "ghost"}" href="lms-live-training.html?appointment=${encodeURIComponent(a.id)}">${joinWindow ? "Enter Live Training" : "View Live Training"}</a>` : ""}
        ${canReschedule ? `<a class="btn ghost" href="${rescheduleUrl}">Reschedule</a>` : ""}
        ${canCancel ? `<button class="btn danger" type="button" data-cancel-id="${esc(a.id)}">Cancel</button>` : ""}
      </div>
    </article>`;
  }

  async function cancelAppointment(event){
    const id = event.currentTarget.dataset.cancelId;
    const appt = state.appointments.find(a => String(a.id) === String(id));
    if (!appt) return;
    if (!window.confirm("Cancel this appointment?")) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await invoke({action:"cancel", appointment_id:id, reason:"Cancelled by learner"});
      await loadData();
    } catch (error) {
      window.alert(error?.message || "Unable to cancel appointment.");
    } finally {
      button.disabled = false;
    }
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();
    const {data:{session}, error} = await db.auth.getSession();
    if (error || !session?.user){
      window.location.replace("https://lms.screenings4u.com/training-login.html");
      return;
    }
    try {
      await loadData();
    } catch (error) {
      console.error("[LMS My Appointments]", error);
      document.getElementById("content").innerHTML = `<div class="notice appointments-error">${esc(error?.message || "Unable to load appointments.")}</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
