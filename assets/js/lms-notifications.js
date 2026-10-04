(() => {
  "use strict";

  console.info("[LMS Notifications] build 20261004-training5");

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:"s4u-training-auth-session"}
  });

  const FONT_KEY = "s4u_lms_font_size";
  const FONT_DEFAULT = 14;
  const FONT_MIN = 12;
  const FONT_MAX = 18;
  const ACTIVE_NAV_INDEX = 10;
  const navItems = [
    ["lms-dashboard.html","Dashboard","⌂"],["lms-my-courses.html","My Courses","▶"],["lms-courses.html","Course Library","▦"],["lms-progress.html","Progress","◉"],["lms-certificates.html","Certificates","✓"],["lms-live-training.html","Live Training","●"],["lms-my-appointments.html","Appointments","◷"],["lms-group-seats.html","Group Seats","♙"],["lms-documents.html","Documents","▤"],["lms-orders.html","Orders","≡"],["lms-notifications.html","Notifications","✉"],["lms-account.html","Account","○"],["lms-support.html","Support","?"]
  ];

  let rows = [];
  let readIds = new Set();
  let currentFilter = "all";
  let currentType = "all";
  let currentUser = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const metric = (label,value,sub) => `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:""}</article>`;
  const normalizeMetadata = value => { if(!value) return {}; if(typeof value === "object") return value; try{return JSON.parse(value);}catch{return {};} };
  const fmtWhen = value => {
    if(!value) return "";
    const d = new Date(value); if(Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
  };

  function readFontSize(){const n=Number(localStorage.getItem(FONT_KEY));return Number.isFinite(n)?Math.min(FONT_MAX,Math.max(FONT_MIN,n)):FONT_DEFAULT;}
  function applyFontSize(n){const value=Math.min(FONT_MAX,Math.max(FONT_MIN,Number(n)||FONT_DEFAULT));document.documentElement.style.setProperty("--portal-font-root",value+"px");localStorage.setItem(FONT_KEY,String(value));const el=document.getElementById("fontSizeValue");if(el)el.textContent=value===FONT_DEFAULT?"Default":String(value);return value;}
  let portalFontSize = applyFontSize(readFontSize());

  function renderShell(){
    const links = navItems.map(([href,label,icon],index)=>`<a href="${href}"${index===ACTIVE_NAV_INDEX?' class="active" aria-current="page"':""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
    document.getElementById("trainingPortalApp").innerHTML = `
      <div class="app">
        <aside class="side" id="side"><div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div><nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav><div class="side-foot"><div style="font-size:.5625rem;color:#9fb3c7">Portal</div><div style="font-size:.6875rem;font-weight:800;color:#fff;margin-top:3px">lms.screenings4u.com</div></div></aside>
        <main class="main">
          <header class="top"><div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button><div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Notifications</span></div></div><div class="top-right"><div class="top-utility-group top-time-group"><div class="portal-clock"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div><div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer"><button type="button" id="fontDown">A−</button><button type="button" class="font-reset" id="fontSizeValue">Default</button><button type="button" id="fontUp">A+</button></div></div><div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div></div></header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Notifications</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content"><section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Notifications</h1><p>Review course, assessment, certificate, support, and account updates connected to your Learning Center account.</p></section><section class="section" id="content"></section></div>
        </main>
      </div>`;
  }

  function bindShell(){
    document.getElementById("fontDown")?.addEventListener("click",()=>{portalFontSize=applyFontSize(portalFontSize-1);});
    document.getElementById("fontUp")?.addEventListener("click",()=>{portalFontSize=applyFontSize(portalFontSize+1);});
    document.getElementById("fontSizeValue")?.addEventListener("click",()=>{portalFontSize=applyFontSize(FONT_DEFAULT);});
    const menu=document.getElementById("menu"),mobile=document.getElementById("mobileNav");
    menu?.addEventListener("click",()=>{const open=!mobile.classList.contains("open");mobile.classList.toggle("open",open);document.body.classList.toggle("mobile-nav-open",open);menu.setAttribute("aria-expanded",String(open));mobile.setAttribute("aria-hidden",String(!open));});
    mobile?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{mobile.classList.remove("open");document.body.classList.remove("mobile-nav-open");menu?.setAttribute("aria-expanded","false");mobile.setAttribute("aria-hidden","true");}));
    document.getElementById("logout")?.addEventListener("click",async()=>{await db.auth.signOut();window.location.replace("https://lms.screenings4u.com/training-login.html");});
  }

  function startClock(){const update=()=>{const now=new Date();const d=document.getElementById("portalClockDate"),t=document.getElementById("portalClockTime");if(d)d.textContent=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(now);if(t)t.textContent=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(now);};update();window.__s4uLmsNotificationsClock=setInterval(update,1000);}

  function typeOf(row){
    const m=normalizeMetadata(row.metadata);
    const source=[m.type,m.notification_type,m.category,m.event,m.kind,row.channel,row.subject,row.body].filter(Boolean).join(" ").toLowerCase();
    if(source.includes("certificate")) return "certificates";
    if(source.includes("assessment")||source.includes("quiz")||source.includes("exam")) return "assessments";
    if(source.includes("support")||source.includes("message")||source.includes("conversation")) return "support";
    if(source.includes("account")||source.includes("profile")||source.includes("password")||source.includes("login")) return "account";
    return "courses";
  }
  function isRead(row){return readIds.has(row.id);}
  function target(row,type){
    const m=normalizeMetadata(row.metadata); const supplied=m.url||m.href||m.link;
    if(typeof supplied==="string" && supplied.trim()) return supplied.trim();
    if(type==="certificates") return "lms-certificates.html";
    if(type==="support") return "lms-support.html";
    if(type==="account") return "lms-account.html";
    if(type==="assessments") return "lms-progress.html";
    return "lms-my-courses.html";
  }
  function icon(type){return ({certificates:"✓",assessments:"A",support:"?",account:"○",courses:"▶"})[type]||"✉";}
  function label(type){return ({certificates:"Certificate",assessments:"Assessment",support:"Support",account:"Account",courses:"Course"})[type]||"Update";}

  async function loadData(userId){
    const [n,r] = await Promise.all([
      db.from("notifications").select("id,recipient_user_id,channel,status,subject,body,metadata,scheduled_for,sent_at,delivered_at,created_at").eq("recipient_user_id",userId).order("created_at",{ascending:false}).limit(100),
      db.from("customer_notification_reads").select("notification_id,read_at").eq("user_id",userId)
    ]);
    if(n.error) throw n.error; if(r.error) throw r.error;
    rows=n.data||[]; readIds=new Set((r.data||[]).map(x=>x.notification_id).filter(Boolean));
    render();
  }

  function visibleRows(){return rows.filter(row=>{const type=typeOf(row);const state=currentFilter==="all"||(currentFilter==="unread"&&!isRead(row))||(currentFilter==="read"&&isRead(row));const kind=currentType==="all"||currentType===type;return state&&kind;});}

  function render(){
    const unread=rows.filter(row=>!isRead(row)).length;
    const read=rows.length-unread;
    const latest=rows[0]?.created_at?fmtWhen(rows[0].created_at):"";
    const visible=visibleRows();
    const cards=visible.map(row=>{const type=typeOf(row),unreadState=!isRead(row),href=target(row,type);return `<article class="notification-card ${unreadState?"unread":"read"}"><div class="notification-symbol">${esc(icon(type))}</div><div class="notification-main"><div class="notification-head"><h3>${esc(row.subject||"Learning Center update")}</h3><span class="notification-time">${esc(fmtWhen(row.created_at||row.sent_at))}</span></div><p class="notification-body">${esc(row.body||"")}</p><div class="notification-meta"><span class="notification-type">${esc(label(type))}</span>${unreadState?'<span class="notification-unread" title="Unread"></span>':""}</div></div><div class="notification-card-actions">${href?`<a href="${esc(href)}">View</a>`:""}${unreadState?`<button type="button" data-mark-read="${esc(row.id)}">Mark Read</button>`:""}</div></article>`;}).join("");
    document.getElementById("content").innerHTML=`
      <div class="metrics snapshot-metrics">${metric("Total Notifications",rows.length,"Latest 100 records")}${metric("Unread",unread,"Needs review")}${metric("Read",read,"Already reviewed")}${metric("Latest Update",latest||"—","Most recent notification")}</div>
      <div class="section"><div class="panel"><div class="panel-head"><div><h2>Notification Center</h2><p class="notification-count">Showing ${visible.length} of ${rows.length} notifications.</p></div></div><div class="notification-toolbar"><div class="notification-filters"><button class="notification-filter ${currentFilter==="all"?"active":""}" data-filter="all">All</button><button class="notification-filter ${currentFilter==="unread"?"active":""}" data-filter="unread">Unread</button><button class="notification-filter ${currentFilter==="read"?"active":""}" data-filter="read">Read</button><select class="notification-select" id="notificationType"><option value="all">All Types</option><option value="courses">Courses</option><option value="assessments">Assessments</option><option value="certificates">Certificates</option><option value="support">Support</option><option value="account">Account</option></select></div><div class="notification-actions-top"><button type="button" id="refreshNotifications">Refresh</button><button type="button" id="markAllRead" ${unread?"":"disabled"}>Mark All Read</button></div></div><div style="height:14px"></div>${cards?`<div class="notification-list">${cards}</div>`:`<div class="notification-empty"><strong>No notifications found</strong><span>There are no real notification records matching this view.</span></div>`}</div></div>`;
    const typeSelect=document.getElementById("notificationType"); if(typeSelect) typeSelect.value=currentType;
    bindContent();
  }

  function bindContent(){
    document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{currentFilter=btn.dataset.filter||"all";render();}));
    document.getElementById("notificationType")?.addEventListener("change",e=>{currentType=e.target.value||"all";render();});
    document.getElementById("refreshNotifications")?.addEventListener("click",()=>loadData(currentUser.id).catch(showError));
    document.getElementById("markAllRead")?.addEventListener("click",()=>markAll().catch(showError));
    document.querySelectorAll("[data-mark-read]").forEach(btn=>btn.addEventListener("click",()=>markRead(btn.dataset.markRead).catch(showError)));
  }

  async function markRead(id){if(!id||readIds.has(id))return;const {error}=await db.from("customer_notification_reads").upsert({notification_id:id,user_id:currentUser.id,read_at:new Date().toISOString()},{onConflict:"notification_id,user_id"});if(error)throw error;readIds.add(id);render();}
  async function markAll(){const pending=rows.filter(r=>!isRead(r));if(!pending.length)return;const now=new Date().toISOString();const {error}=await db.from("customer_notification_reads").upsert(pending.map(r=>({notification_id:r.id,user_id:currentUser.id,read_at:now})),{onConflict:"notification_id,user_id"});if(error)throw error;pending.forEach(r=>readIds.add(r.id));render();}
  function showError(error){console.error("[LMS Notifications]",error);const content=document.getElementById("content");if(content)content.innerHTML=`<div class="notification-error">${esc(error?.message||"Unable to load notifications.")}</div>`;}

  async function init(){
    renderShell(); bindShell(); startClock();
    const {data,error}=await db.auth.getSession(); if(error)throw error;
    const session=data?.session; if(!session?.user?.id){window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-notifications.html");return;}
    currentUser=session.user;
    try{await loadData(currentUser.id);}catch(error){showError(error);}
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
