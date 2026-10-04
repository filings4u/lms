(() => {
  "use strict";

  console.info("[LMS My Courses] build 20261004-training3");

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
  const ACTIVE_NAV_INDEX = 1;

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

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pct = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  };
  const fmtDate = value => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {month:"short", day:"numeric", year:"numeric"}).format(d);
  };
  const statusLabel = row => {
    const progress = pct(row.progress_percent);
    if (row.status === "completed" || progress >= 100) return "Completed";
    if (progress > 0) return "In Progress";
    return "Not Started";
  };
  const statusClass = value => value === "Completed" ? "good" : value === "In Progress" ? "warn" : "";
  const badge = value => `<span class="badge ${statusClass(value)}">${esc(value)}</span>`;
  const metric = (label, value, sub) => `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}</article>`;

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
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">My Courses</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">My Courses</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>My Courses</h1><p>View assigned training, continue active courses, and access completed course records.</p></section>
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

  async function loadData(userId){
    const {data: enrollments, error: enrollmentError} = await db
      .from("lms_enrollments")
      .select("id,course_id,status,progress_percent,enrolled_at,started_at,completed_at,last_activity_at,expires_at,course:lms_courses(id,slug,title,short_description,status,certificate_enabled)")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("last_activity_at", {ascending:false, nullsFirst:false});
    if (enrollmentError) throw enrollmentError;

    const rows = (enrollments || []).filter(row => row.course?.id && row.course?.title);
    const enrollmentIds = rows.map(row => row.id);
    let certificates = [];

    if (enrollmentIds.length){
      const certResult = await db
        .from("lms_certificates")
        .select("id,enrollment_id,status,issued_at,certificate_number")
        .in("enrollment_id", enrollmentIds)
        .eq("status", "issued");
      if (certResult.error) throw certResult.error;
      certificates = certResult.data || [];
    }

    renderCourses(rows, certificates);
  }

  function renderCourses(rows, certificates){
    const active = rows.filter(row => row.status === "active" && pct(row.progress_percent) < 100);
    const completed = rows.filter(row => row.status === "completed" || pct(row.progress_percent) >= 100);
    const avgProgress = rows.length ? Math.round(rows.reduce((sum,row) => sum + pct(row.progress_percent), 0) / rows.length) : 0;
    const inProgress = active.filter(row => pct(row.progress_percent) > 0);

    const metrics = [
      ["Active Courses", active.length, "Training in progress"],
      ["Completed Courses", completed.length, "Finished enrollments"],
      ["Average Progress", `${avgProgress}%`, "Across assigned courses"],
      ["Certificates", certificates.length, "Issued certificates"]
    ];

    const continueRows = inProgress.slice(0, 5).map(row => {
      const progress = pct(row.progress_percent);
      return `<a class="attention-row" href="lms-course-player.html?course=${encodeURIComponent(row.course.id)}&enrollment=${encodeURIComponent(row.id)}"><div><strong>${esc(row.course.title)}</strong><span>${progress}% complete${row.last_activity_at ? ` · Last activity ${esc(fmtDate(row.last_activity_at))}` : ""}</span></div><span>→</span></a>`;
    }).join("");

    const tableRows = rows.map(row => {
      const progress = pct(row.progress_percent);
      const status = statusLabel(row);
      const certificate = certificates.find(item => item.enrollment_id === row.id);
      let href = `lms-course-player.html?course=${encodeURIComponent(row.course.id)}&enrollment=${encodeURIComponent(row.id)}`;
      let action = progress > 0 ? "Continue" : "Start";

      if (status === "Completed" && certificate){
        href = `lms-certificates.html?certificate=${encodeURIComponent(certificate.id)}`;
        action = "Certificate";
      } else if (status === "Completed") {
        action = "Review";
      }

      return `<tr>
        <td><strong>${esc(row.course.title)}</strong>${row.course.short_description ? `<small>${esc(row.course.short_description)}</small>` : ""}</td>
        <td>${progress}%</td>
        <td>${badge(status)}</td>
        <td>${row.enrolled_at ? esc(fmtDate(row.enrolled_at)) : ""}</td>
        <td>${row.expires_at ? esc(fmtDate(row.expires_at)) : ""}</td>
        <td>${row.last_activity_at ? esc(fmtDate(row.last_activity_at)) : ""}</td>
        <td><a class="snapshot-link" href="${href}">${esc(action)}</a></td>
      </tr>`;
    }).join("");

    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="metrics">${metrics.map(item => metric(...item)).join("")}</div>
      ${continueRows ? `<div class="section"><div class="panel"><div class="panel-head"><div><h2>Continue Learning</h2><p>Active courses you have already started.</p></div></div><div class="snapshot-attention">${continueRows}</div></div></div>` : ""}
      ${tableRows ? `<div class="section"><div class="panel"><div class="panel-head"><div><h2>My Courses</h2><p>All active and completed Learning Center enrollments.</p></div><a class="snapshot-link" href="lms-courses.html">Course Library</a></div><div class="table-wrap"><table><thead><tr><th>Course</th><th>Progress</th><th>Status</th><th>Enrolled</th><th>Access Through</th><th>Last Activity</th><th></th></tr></thead><tbody>${tableRows}</tbody></table></div></div></div>` : ""}`;
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();

    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id){
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-my-courses.html");
      return;
    }

    try{
      await loadData(session.user.id);
    }catch(error){
      console.error("[LMS My Courses]", error);
      throw error;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
