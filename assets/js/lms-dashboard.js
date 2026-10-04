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
    ["lms-support.html", "Support", "? "]
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
  const statusClass = value => /complete|completed|issued|active/i.test(String(value || "")) ? "good" : /expired|cancel/i.test(String(value || "")) ? "bad" : "warn";
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
    const links = navItems.map(([href,label,icon], index) => `<a href="${href}"${index === 0 ? ' class="active" aria-current="page"' : ""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
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
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Dashboard</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Dashboard</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Dashboard</h1><p>Snapshot of your assigned training, course progress, certificates, and recent learning activity.</p></section>
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

  async function loadDashboard(userId){
    const {data: enrollments, error: enrollmentError} = await db
      .from("lms_enrollments")
      .select("id,course_id,status,progress_percent,enrolled_at,started_at,completed_at,last_activity_at,expires_at,course:lms_courses(id,slug,title,short_description,status,certificate_enabled)")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("last_activity_at", {ascending:false, nullsFirst:false});
    if (enrollmentError) throw enrollmentError;

    const rows = (enrollments || []).filter(r => r.course?.id && r.course?.title);
    const ids = rows.map(r => r.id);
    let certificates = [];
    let lessonProgress = [];
    if (ids.length){
      const [certResult, progressResult] = await Promise.all([
        db.from("lms_certificates").select("id,enrollment_id,status,issued_at").in("enrollment_id", ids).eq("status", "issued"),
        db.from("lms_lesson_progress").select("id,enrollment_id,lesson_id,progress_percent,started_at,completed_at,last_activity_at,lesson:lms_lessons(id,title)").in("enrollment_id", ids).order("last_activity_at", {ascending:false, nullsFirst:false}).limit(50)
      ]);
      if (certResult.error) throw certResult.error;
      if (progressResult.error) throw progressResult.error;
      certificates = certResult.data || [];
      lessonProgress = progressResult.data || [];
    }

    renderDashboard(rows, certificates, lessonProgress);
  }

  function renderDashboard(rows, certificates, lessonProgress){
    const active = rows.filter(r => r.status === "active" && pct(r.progress_percent) < 100);
    const completed = rows.filter(r => r.status === "completed" || pct(r.progress_percent) >= 100);
    const notStarted = active.filter(r => pct(r.progress_percent) === 0).length;
    const avgProgress = rows.length ? Math.round(rows.reduce((sum,r) => sum + pct(r.progress_percent), 0) / rows.length) : 0;
    const completedLessons = lessonProgress.filter(r => r.completed_at || Number(r.progress_percent) >= 100).length;
    const minutes = lessonProgress.reduce((sum, row) => {
      if (!row.started_at || !row.completed_at) return sum;
      const start = new Date(row.started_at).getTime();
      const end = new Date(row.completed_at).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return sum;
      return sum + Math.min((end - start) / 60000, 480);
    }, 0);
    const learningHours = Math.round((minutes / 60) * 10) / 10;

    const metrics = [
      ["Active Courses", active.length, "Training in progress"],
      ["Completed Courses", completed.length, "Finished enrollments"],
      ["Total Enrollments", rows.length, "Assigned courses"],
      ["Certificates", certificates.length, "Issued certificates"],
      ["Average Progress", `${avgProgress}%`, "Across assigned courses"],
      ["Completed Lessons", completedLessons, "Recorded completions"],
      ["Learning Hours", learningHours, "Recorded course activity"],
      ["Not Started", notStarted, "Active courses at 0%"]
    ];

    const attention = active.slice(0, 5).map(r => {
      const progress = pct(r.progress_percent);
      return `<a class="attention-row" href="lms-course-player.html?course=${encodeURIComponent(r.course.id)}&enrollment=${encodeURIComponent(r.id)}"><div><strong>${esc(r.course.title)}</strong><span>${progress}% complete</span></div><span>→</span></a>`;
    }).join("");

    const courseRows = rows.slice(0, 8).map(r => {
      const progress = pct(r.progress_percent);
      const status = r.status === "completed" || progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
      return `<tr><td><strong>${esc(r.course.title)}</strong>${r.course.short_description ? `<small>${esc(r.course.short_description)}</small>` : ""}</td><td>${progress}%</td><td>${badge(status)}</td><td>${r.last_activity_at ? esc(fmtDate(r.last_activity_at)) : ""}</td><td><a class="snapshot-link" href="lms-course-player.html?course=${encodeURIComponent(r.course.id)}&enrollment=${encodeURIComponent(r.id)}">Open</a></td></tr>`;
    }).join("");

    const activity = lessonProgress.filter(r => r.lesson?.title).slice(0, 8).map(r => `<div class="activity-row"><span class="activity-type">${r.completed_at ? "Completed" : "Progress"}</span><div><strong>${esc(r.lesson.title)}</strong>${r.last_activity_at ? `<small>${esc(fmtDate(r.last_activity_at))}</small>` : ""}</div>${badge(r.completed_at ? "Completed" : `${pct(r.progress_percent)}%`)}</div>`).join("");

    const newestCert = certificates.slice().sort((a,b) => new Date(b.issued_at || 0) - new Date(a.issued_at || 0))[0];
    const lastActivity = rows.find(r => r.last_activity_at)?.last_activity_at || lessonProgress.find(r => r.last_activity_at)?.last_activity_at;
    const planChips = [
      rows.length ? `${rows.length} Enrollments` : "",
      active.length ? `${active.length} Active` : "",
      completed.length ? `${completed.length} Completed` : "",
      certificates.length ? `${certificates.length} Certificates` : ""
    ].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("");

    document.getElementById("content").innerHTML = `
      <div class="metrics snapshot-metrics">${metrics.map(x => metric(...x)).join("")}</div>
      <div class="section snapshot-grid">
        <div class="panel"${attention ? "" : ' hidden'}><div class="panel-head"><div><h2>Continue Learning</h2><p>Active courses that still require completion.</p></div><a class="snapshot-link" href="lms-my-courses.html">My Courses</a></div><div class="snapshot-attention">${attention}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>Learning Snapshot</h2><p>Your current Learning Center activity.</p></div></div><div class="snapshot-plan"><strong>${rows.length ? "Learning Center Account" : ""}</strong>${lastActivity ? `<span>Last activity ${esc(fmtDate(lastActivity))}</span>` : ""}<div class="plan-chips">${planChips}</div>${newestCert?.issued_at ? `<span style="margin-top:12px">Latest certificate ${esc(fmtDate(newestCert.issued_at))}</span>` : ""}</div></div>
      </div>
      <div class="section"${courseRows ? "" : ' hidden'}><div class="panel"><div class="panel-head"><div><h2>My Courses</h2><p>Your assigned and completed training.</p></div><a class="snapshot-link" href="lms-my-courses.html">View All Courses</a></div><div class="table-wrap"><table><thead><tr><th>Course</th><th>Progress</th><th>Status</th><th>Last Activity</th><th></th></tr></thead><tbody>${courseRows}</tbody></table></div></div></div>
      <div class="section snapshot-grid">
        <div class="panel"${activity ? "" : ' hidden'}><div class="panel-head"><div><h2>Recent Activity</h2><p>Latest lesson progress and completions.</p></div></div><div class="activity-list">${activity}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>Learning Tools</h2><p>Training records and learner services.</p></div></div><div class="snapshot-attention"><a class="attention-row" href="lms-progress.html"><div><strong>Progress Report</strong><span>Review course completion history</span></div><span>→</span></a><a class="attention-row" href="lms-certificates.html"><div><strong>Certificate Center</strong><span>View earned certificates</span></div><span>→</span></a><a class="attention-row" href="lms-my-appointments.html"><div><strong>Appointments</strong><span>Manage scheduled training sessions</span></div><span>→</span></a></div></div>
      </div>`;
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();
    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id){
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-dashboard.html");
      return;
    }
    try{
      await loadDashboard(session.user.id);
    }catch(error){
      console.error("[LMS Dashboard]", error);
      throw error;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
