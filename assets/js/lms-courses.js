(() => {
  "use strict";

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
  const ACTIVE_NAV_INDEX = 2;

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

  let portalFontSize = Number(localStorage.getItem(FONT_KEY) || FONT_DEFAULT);
  let state = { courses: [], enrollments: [], query: "", filter: "all" };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const pct = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

  function applyFontSize(value){
    const size = Math.max(FONT_MIN, Math.min(FONT_MAX, Number(value) || FONT_DEFAULT));
    document.documentElement.style.setProperty("--portal-font-root", `${size}px`);
    localStorage.setItem(FONT_KEY, String(size));
    const label = document.getElementById("fontSizeValue");
    if (label) label.textContent = size === FONT_DEFAULT ? "Default" : String(size);
    return size;
  }

  function renderShell(){
    const links = navItems.map(([href,label,icon], index) => `<a href="${href}"${index === ACTIVE_NAV_INDEX ? ' class="active" aria-current="page"' : ""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");

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
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Course Library</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Course Library</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Course Library</h1><p>Browse published Learning Center courses and open the training assigned to your account.</p></section>
            <section class="section" id="content"></section>
          </div>
        </main>
      </div>`;
  }

  function startClock(){
    const update = () => {
      const now = new Date();
      const dateEl = document.getElementById("portalClockDate");
      const timeEl = document.getElementById("portalClockTime");
      if (dateEl) dateEl.textContent = new Intl.DateTimeFormat("en-US", {weekday:"short", month:"short", day:"numeric", year:"numeric"}).format(now);
      if (timeEl) timeEl.textContent = new Intl.DateTimeFormat("en-US", {hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true}).format(now);
    };
    update();
    window.__s4uLmsCoursesClock = setInterval(update, 1000);
  }

  function bindShell(){
    portalFontSize = applyFontSize(portalFontSize);
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

  function enrollmentFor(courseId){
    return state.enrollments.find(row => row.course_id === courseId) || null;
  }

  function courseStatus(course){
    const enrollment = enrollmentFor(course.id);
    if (!enrollment) return "Available";
    const progress = pct(enrollment.progress_percent);
    if (enrollment.status === "completed" || progress >= 100) return "Completed";
    if (progress > 0) return "In Progress";
    return "Assigned";
  }

  function badgeClass(label){
    if (label === "Completed") return "good";
    if (label === "In Progress" || label === "Assigned") return "warn";
    return "";
  }

  function actionFor(course){
    const enrollment = enrollmentFor(course.id);
    if (!enrollment) return { label: "View Course", href: `lms-course-details.html?course=${encodeURIComponent(course.id)}` };
    const progress = pct(enrollment.progress_percent);
    return {
      label: enrollment.status === "completed" || progress >= 100 ? "Review" : progress > 0 ? "Continue" : "Start",
      href: `lms-course-player.html?course=${encodeURIComponent(course.id)}&enrollment=${encodeURIComponent(enrollment.id)}`
    };
  }

  function renderLibrary(){
    const q = state.query.trim().toLowerCase();
    const filtered = state.courses.filter(course => {
      const status = courseStatus(course);
      if (state.filter === "enrolled" && status === "Available") return false;
      if (state.filter === "available" && status !== "Available") return false;
      if (state.filter === "completed" && status !== "Completed") return false;
      if (!q) return true;
      return `${course.title || ""} ${course.short_description || ""}`.toLowerCase().includes(q);
    });

    const cards = filtered.map(course => {
      const enrollment = enrollmentFor(course.id);
      const status = courseStatus(course);
      const progress = enrollment ? pct(enrollment.progress_percent) : 0;
      const action = actionFor(course);
      return `<article class="course-library-card">
        <div class="course-library-card-top">
          <span class="badge ${badgeClass(status)}">${esc(status)}</span>
          ${course.pace ? `<span class="course-library-count">${esc(String(course.pace).replaceAll("_", " "))}</span>` : ""}
        </div>
        <h3>${esc(course.title)}</h3>
        ${course.short_description ? `<p>${esc(course.short_description)}</p>` : ""}
        <div class="course-library-meta">
          ${course.certificate_enabled ? `<span class="badge">Certificate</span>` : ""}
          ${enrollment?.expires_at ? `<span class="badge">Access through ${esc(new Intl.DateTimeFormat("en-US", {month:"short", day:"numeric", year:"numeric"}).format(new Date(enrollment.expires_at)))}</span>` : ""}
        </div>
        ${enrollment ? `<div class="course-library-progress"><div class="course-library-progress-head"><span>Progress</span><span>${progress}%</span></div><div class="course-library-progress-track"><span style="width:${progress}%"></span></div></div>` : ""}
        <div class="course-library-actions"><a class="btn primary" href="${action.href}">${esc(action.label)}</a></div>
      </article>`;
    }).join("");

    const enrolledCount = state.courses.filter(course => courseStatus(course) !== "Available").length;
    const completedCount = state.courses.filter(course => courseStatus(course) === "Completed").length;

    document.getElementById("content").innerHTML = `
      <div class="metrics">
        <article class="metric"><small>Published Courses</small><strong>${state.courses.length}</strong><span>Learning Center catalog</span></article>
        <article class="metric"><small>Assigned to You</small><strong>${enrolledCount}</strong><span>Current enrollments</span></article>
        <article class="metric"><small>Completed</small><strong>${completedCount}</strong><span>Finished training</span></article>
        <article class="metric"><small>Available</small><strong>${Math.max(0, state.courses.length - enrolledCount)}</strong><span>Not currently assigned</span></article>
      </div>
      <div class="section">
        <div class="panel">
          <div class="panel-head"><div><h2>Course Library</h2><p>Published screenings4u Learning Center courses.</p></div><span class="course-library-count">${filtered.length} course${filtered.length === 1 ? "" : "s"}</span></div>
          <div class="course-library-toolbar">
            <div class="field"><label for="courseSearch">Search courses</label><input id="courseSearch" type="search" value="${esc(state.query)}" autocomplete="off"></div>
            <div class="field"><label for="courseFilter">Show</label><select id="courseFilter"><option value="all"${state.filter === "all" ? " selected" : ""}>All published courses</option><option value="enrolled"${state.filter === "enrolled" ? " selected" : ""}>Assigned to me</option><option value="available"${state.filter === "available" ? " selected" : ""}>Available courses</option><option value="completed"${state.filter === "completed" ? " selected" : ""}>Completed courses</option></select></div>
          </div>
          ${cards ? `<div class="course-library-grid">${cards}</div>` : `<div class="course-library-panel-empty">No courses match the current search or filter.</div>`}
        </div>
      </div>`;

    const search = document.getElementById("courseSearch");
    const filter = document.getElementById("courseFilter");
    search?.addEventListener("input", event => { state.query = event.target.value; renderLibrary(); document.getElementById("courseSearch")?.focus(); });
    filter?.addEventListener("change", event => { state.filter = event.target.value; renderLibrary(); });
  }

  async function loadData(userId){
    const [courseResult, enrollmentResult] = await Promise.all([
      db.from("lms_courses")
        .select("id,slug,title,short_description,status,certificate_enabled,pace,published_at")
        .eq("status", "published")
        .order("title", {ascending:true}),
      db.from("lms_enrollments")
        .select("id,course_id,status,progress_percent,enrolled_at,completed_at,last_activity_at,expires_at")
        .eq("user_id", userId)
        .in("status", ["active", "completed"])
    ]);

    if (courseResult.error) throw courseResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;

    state.courses = (courseResult.data || []).filter(course => course.id && course.title);
    state.enrollments = enrollmentResult.data || [];
    renderLibrary();
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();

    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id){
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-courses.html");
      return;
    }

    try{
      await loadData(session.user.id);
    }catch(error){
      console.error("[LMS Course Library]", error);
      throw error;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
