(() => {
  "use strict";

  console.info("[LMS Progress] build 20261004-training4");

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
  const ACTIVE_NAV_INDEX = 3;

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
  const metric = (label, value, sub) => `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}</article>`;
  const badge = (label, kind="") => `<span class="badge ${kind}">${esc(label)}</span>`;

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
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Progress</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Progress</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Progress</h1><p>Review course completion, lesson activity, assessments, and certificate status across your assigned training.</p></section>
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
    window.__s4uLmsProgressClock = setInterval(update, 1000);
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
      .select("id,course_id,status,progress_percent,enrolled_at,started_at,completed_at,last_activity_at,expires_at,course:lms_courses(id,slug,title,certificate_enabled)")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("last_activity_at", {ascending:false, nullsFirst:false});
    if (enrollmentError) throw enrollmentError;

    const rows = (enrollments || []).filter(row => row.course?.id && row.course?.title);
    const enrollmentIds = rows.map(row => row.id);

    let lessons = [];
    let quizzes = [];
    let certificates = [];

    if (enrollmentIds.length){
      const [lessonResult, quizResult, certResult] = await Promise.all([
        db.from("lms_lesson_progress").select("id,enrollment_id,lesson_id,progress_percent,started_at,completed_at,last_activity_at,lesson:lms_lessons(id,title)").in("enrollment_id", enrollmentIds).order("last_activity_at", {ascending:false, nullsFirst:false}),
        db.from("lms_quiz_attempts").select("id,enrollment_id,quiz_id,score,passed,started_at,completed_at").in("enrollment_id", enrollmentIds).order("completed_at", {ascending:false, nullsFirst:false}),
        db.from("lms_certificates").select("id,enrollment_id,status,issued_at").in("enrollment_id", enrollmentIds).order("issued_at", {ascending:false, nullsFirst:false})
      ]);
      if (lessonResult.error) throw lessonResult.error;
      if (quizResult.error) throw quizResult.error;
      if (certResult.error) throw certResult.error;
      lessons = lessonResult.data || [];
      quizzes = quizResult.data || [];
      certificates = (certResult.data || []).filter(row => String(row.status || "").toLowerCase() !== "revoked");
    }

    render(rows, lessons, quizzes, certificates);
  }

  function render(rows, lessons, quizzes, certificates){
    const active = rows.filter(row => row.status === "active" && pct(row.progress_percent) < 100);
    const completed = rows.filter(row => row.status === "completed" || pct(row.progress_percent) >= 100);
    const average = rows.length ? Math.round(rows.reduce((sum,row) => sum + pct(row.progress_percent), 0) / rows.length) : 0;
    const completedLessons = lessons.filter(row => row.completed_at || pct(row.progress_percent) >= 100).length;
    const passedQuizzes = quizzes.filter(row => row.passed === true).length;
    const issuedCerts = certificates.filter(row => String(row.status || "").toLowerCase() === "issued").length;

    const metrics = [
      ["Average Progress", `${average}%`, "Across assigned courses"],
      ["Active Courses", active.length, "Training in progress"],
      ["Completed Courses", completed.length, "Finished enrollments"],
      ["Completed Lessons", completedLessons, "Recorded completions"],
      ["Passed Assessments", passedQuizzes, "Successful quiz attempts"],
      ["Certificates", issuedCerts, "Issued certificates"],
      ["Total Enrollments", rows.length, "Assigned courses"],
      ["Not Started", active.filter(row => pct(row.progress_percent) === 0).length, "Courses at 0%"]
    ];

    const courseRows = rows.map(row => {
      const progress = pct(row.progress_percent);
      const done = row.status === "completed" || progress >= 100;
      const cert = certificates.find(c => c.enrollment_id === row.id && String(c.status || "").toLowerCase() === "issued");
      const status = done ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
      const kind = done ? "good" : progress > 0 ? "warn" : "";
      const actionHref = cert ? "lms-certificates.html" : `lms-course-player.html?course=${encodeURIComponent(row.course.id)}&enrollment=${encodeURIComponent(row.id)}`;
      const actionLabel = cert ? "Certificate" : done ? "Review" : progress > 0 ? "Continue" : "Start";
      return `<tr>
        <td data-label="Course"><strong>${esc(row.course.title)}</strong></td>
        <td data-label="Progress"><strong>${progress}%</strong><div style="height:6px;background:#edf1f6;border-radius:999px;overflow:hidden;margin-top:6px;min-width:120px"><div style="height:100%;width:${progress}%;background:#ef6c00"></div></div></td>
        <td data-label="Status">${badge(status, kind)}</td>
        <td data-label="Last Activity">${esc(fmtDate(row.last_activity_at))}</td>
        <td data-label="Completed">${esc(fmtDate(row.completed_at))}</td>
        <td data-label="Action"><a class="snapshot-link" href="${actionHref}">${actionLabel}</a></td>
      </tr>`;
    }).join("");

    const activityItems = [];
    lessons.filter(row => row.completed_at && row.lesson?.title).forEach(row => activityItems.push({at:row.completed_at, title:row.lesson.title, detail:"Lesson completed", kind:"good"}));
    quizzes.filter(row => row.completed_at).forEach(row => activityItems.push({at:row.completed_at, title:row.passed ? "Assessment passed" : "Assessment completed", detail:Number.isFinite(Number(row.score)) ? `${Number(row.score)}% score` : "", kind:row.passed ? "good" : "warn"}));
    certificates.filter(row => row.issued_at).forEach(row => activityItems.push({at:row.issued_at, title:"Certificate issued", detail:"Training completion recorded", kind:"good"}));
    activityItems.sort((a,b) => new Date(b.at) - new Date(a.at));

    const activity = activityItems.slice(0, 8).map(item => `<div class="activity-row"><span class="activity-type">${esc(item.detail)}</span><div><strong>${esc(item.title)}</strong><small>${esc(fmtDate(item.at))}</small></div>${badge(item.kind === "good" ? "Complete" : "Recorded", item.kind)}</div>`).join("");

    const inProgress = active.filter(row => pct(row.progress_percent) > 0).slice(0, 5).map(row => `<a class="attention-row" href="lms-course-player.html?course=${encodeURIComponent(row.course.id)}&enrollment=${encodeURIComponent(row.id)}"><div><strong>${esc(row.course.title)}</strong><span>${pct(row.progress_percent)}% complete</span></div><span>→</span></a>`).join("");

    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="metrics snapshot-metrics">${metrics.map(item => metric(...item)).join("")}</div>
      <div class="section snapshot-grid">
        <div class="panel"${inProgress ? "" : " hidden"}><div class="panel-head"><div><h2>Continue Learning</h2><p>Active courses with recorded progress.</p></div><a class="snapshot-link" href="lms-my-courses.html">My Courses</a></div><div class="snapshot-attention">${inProgress}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>Progress Summary</h2><p>Current learner completion totals.</p></div></div><div class="snapshot-plan"><strong>${average}% Average Progress</strong><span>${completed.length} of ${rows.length} courses completed</span><div class="plan-chips"><span>${completedLessons} Lessons</span><span>${passedQuizzes} Assessments</span><span>${issuedCerts} Certificates</span></div></div></div>
      </div>
      <div class="section"${courseRows ? "" : " hidden"}><div class="panel"><div class="panel-head"><div><h2>Course Progress</h2><p>Progress across all assigned training.</p></div></div><div class="table-wrap"><table><thead><tr><th>Course</th><th>Progress</th><th>Status</th><th>Last Activity</th><th>Completed</th><th></th></tr></thead><tbody>${courseRows}</tbody></table></div></div></div>
      <div class="section snapshot-grid">
        <div class="panel"${activity ? "" : " hidden"}><div class="panel-head"><div><h2>Recent Learning Activity</h2><p>Latest recorded lesson, assessment, and certificate events.</p></div></div><div class="activity-list">${activity}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>Learning Records</h2><p>Related learner records and completion documents.</p></div></div><div class="snapshot-attention"><a class="attention-row" href="lms-certificates.html"><div><strong>Certificates</strong><span>View issued completion certificates</span></div><span>→</span></a><a class="attention-row" href="lms-my-courses.html"><div><strong>My Courses</strong><span>Continue or review assigned training</span></div><span>→</span></a></div></div>
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
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-progress.html");
      return;
    }

    try {
      await loadData(session.user.id);
    } catch (error) {
      console.error("[LMS Progress]", error);
      throw error;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
