(() => {
  "use strict";
  console.info("[LMS Group Seats] build 20261004-training4");

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:"s4u-training-auth-session"}
  });

  const FONT_KEY="s4u_lms_font_size", FONT_DEFAULT=14, FONT_MIN=12, FONT_MAX=18;
  const navItems=[
    ["lms-dashboard.html","Dashboard","⌂"],["lms-my-courses.html","My Courses","▶"],["lms-courses.html","Course Library","▦"],["lms-progress.html","Progress","◉"],["lms-certificates.html","Certificates","✓"],["lms-live-training.html","Live Training","●"],["lms-my-appointments.html","Appointments","◷"],["lms-group-seats.html","Group Seats","♙"],["lms-documents.html","Documents","▤"],["lms-orders.html","Orders","≡"],["lms-notifications.html","Notifications","✉"],["lms-account.html","Account","○"],["lms-support.html","Support","?"]
  ];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const metric=(label,value,sub)=>`<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:""}</article>`;
  const fmtDate=v=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d)};
  let purchases=[];

  function readFontSize(){const n=Number(localStorage.getItem(FONT_KEY));return Number.isFinite(n)?Math.min(FONT_MAX,Math.max(FONT_MIN,n)):FONT_DEFAULT}
  function applyFontSize(n){const value=Math.min(FONT_MAX,Math.max(FONT_MIN,Number(n)||FONT_DEFAULT));document.documentElement.style.setProperty("--portal-font-root",value+"px");localStorage.setItem(FONT_KEY,String(value));const el=document.getElementById("fontSizeValue");if(el)el.textContent=value===FONT_DEFAULT?"Default":String(value);return value}
  let portalFontSize=applyFontSize(readFontSize());

  function renderShell(){
    const links=navItems.map(([href,label,icon],i)=>`<a href="${href}"${i===7?' class="active" aria-current="page"':""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
    document.getElementById("trainingPortalApp").innerHTML=`<div class="app"><aside class="side" id="side"><div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div><nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav><div class="side-foot"><div style="font-size:.5625rem;color:#9fb3c7">Portal</div><div style="font-size:.6875rem;font-weight:800;color:#fff;margin-top:3px">lms.screenings4u.com</div></div></aside><main class="main"><header class="top"><div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation"><span>☰</span></button><span class="crumb">Group Seats</span></div><div class="top-right"><div class="font-sizer"><button id="fontDown" type="button">A−</button><button id="fontSizeValue" class="font-reset" type="button">Default</button><button id="fontUp" type="button">A+</button></div><span class="pill" id="portalClock"></span><button class="signout" id="logout" type="button">Sign Out</button></div></header><div class="content"><section class="hero"><div class="hero-kicker">LEARNER MANAGEMENT</div><h1>Group Training Seats</h1><p>Assign and manage learner seats from group training purchases tied to your Learning Center account.</p></section><section class="section" id="content"><div class="loading-msg">Loading group seat purchases…</div></section></div></main></div>`;
  }
  function bindShell(){
    document.getElementById("fontDown")?.addEventListener("click",()=>portalFontSize=applyFontSize(portalFontSize-1));
    document.getElementById("fontUp")?.addEventListener("click",()=>portalFontSize=applyFontSize(portalFontSize+1));
    document.getElementById("fontSizeValue")?.addEventListener("click",()=>portalFontSize=applyFontSize(FONT_DEFAULT));
    document.getElementById("menu")?.addEventListener("click",()=>document.getElementById("side")?.classList.toggle("open"));
    document.getElementById("logout")?.addEventListener("click",async()=>{await db.auth.signOut();location.replace("https://lms.screenings4u.com/training-login.html")});
  }
  function startClock(){const el=document.getElementById("portalClock");const tick=()=>{if(el)el.textContent=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date())};tick();setInterval(tick,60000)}

  async function call(body){
    const {data,error}=await db.functions.invoke("lms-group-seat-actions",{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data||{};
  }
  function showMessage(text,bad=false){const el=document.getElementById("seatMessage");if(!el)return;el.textContent=text;el.className=`seat-message ${bad?"bad":"good"}`;window.setTimeout(()=>{el.className="seat-message";el.textContent=""},6000)}

  function purchaseCard(p){
    const assignments=Array.isArray(p.assignments)?p.assignments:[];
    const active=assignments.filter(a=>a.status==="active");
    const total=Number(p.seats_purchased||0), used=Number(p.seats_used||0), available=Math.max(0,Number(p.seats_available??(total-used)));
    const percent=total?Math.min(100,Math.round((used/total)*100)):0;
    const course=p.lms_courses?.title||p.lms_training_products?.name||"";
    const rows=assignments.map(a=>`<div class="assignment-row"><strong>${esc(a.learner_name||"")}</strong><span>${esc(a.learner_email||"")}</span><span class="badge ${a.status==="active"?"good":"bad"}">${esc(a.status||"")}</span>${a.status==="active"?`<button class="seat-revoke" type="button" data-revoke="${esc(a.id)}" data-purchase="${esc(p.id)}">Revoke</button>`:"<span></span>"}</div>`).join("");
    return `<article class="seat-card"><div class="seat-card-head"><div><h3>${esc(course)}</h3><p>${p.lms_training_products?.name?esc(p.lms_training_products.name):""}</p><div class="purchase-meta"><span>${esc(p.status||"")}</span>${p.created_at?`<span>Purchased ${esc(fmtDate(p.created_at))}</span>`:""}</div></div><div class="seat-count">${available} available<small>${used} of ${total} assigned</small></div></div><div class="seat-body"><div class="seat-bar"><span style="width:${percent}%"></span></div>${available>0&&p.status==="active"?`<form class="seat-form" data-assign="${esc(p.id)}"><div class="field"><label>First Name</label><input name="first_name" autocomplete="given-name" required></div><div class="field"><label>Last Name</label><input name="last_name" autocomplete="family-name" required></div><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Phone</label><input name="phone" type="tel" autocomplete="tel"></div><div class="seat-form-actions"><button class="btn primary" type="submit">Assign Learner Seat</button></div></form>`:""}<div class="assignment-list">${rows||'<div class="seat-empty">No learner seats are currently assigned.</div>'}</div></div></article>`;
  }

  function render(){
    const totalPurchased=purchases.reduce((n,p)=>n+Number(p.seats_purchased||0),0);
    const totalAssigned=purchases.reduce((n,p)=>n+Number(p.seats_used||0),0);
    const totalAvailable=purchases.reduce((n,p)=>n+Math.max(0,Number(p.seats_available??(Number(p.seats_purchased||0)-Number(p.seats_used||0)))),0);
    const activePackages=purchases.filter(p=>p.status==="active").length;
    document.getElementById("content").innerHTML=`<div id="seatMessage" class="seat-message"></div><div class="metrics">${metric("Seat Packages",purchases.length,"Group purchases")}${metric("Seats Purchased",totalPurchased,"Total capacity")}${metric("Assigned Seats",totalAssigned,"Active assignments")}${metric("Available Seats",totalAvailable,`${activePackages} active package${activePackages===1?"":"s"}`)}</div><div class="section">${purchases.length?`<div class="group-grid">${purchases.map(purchaseCard).join("")}</div>`:'<div class="panel"><div class="empty">No group seat purchases are attached to this account.</div></div>'}</div>`;
    document.querySelectorAll("[data-assign]").forEach(form=>form.addEventListener("submit",assignSeat));
    document.querySelectorAll("[data-revoke]").forEach(btn=>btn.addEventListener("click",revokeSeat));
  }

  async function assignSeat(e){
    e.preventDefault();const form=e.currentTarget;const fd=new FormData(form);const button=form.querySelector("button[type=submit]");if(button)button.disabled=true;
    try{await call({action:"assign",purchase_id:form.dataset.assign,first_name:fd.get("first_name"),last_name:fd.get("last_name"),email:fd.get("email"),phone:fd.get("phone")});form.reset();await load();showMessage("Learner seat assigned.");}
    catch(err){showMessage(err?.message||"Unable to assign learner seat.",true)}
    finally{if(button)button.disabled=false}
  }
  async function revokeSeat(e){
    const btn=e.currentTarget;if(!confirm("Revoke this learner seat?"))return;btn.disabled=true;
    try{await call({action:"revoke",purchase_id:btn.dataset.purchase,assignment_id:btn.dataset.revoke});await load();showMessage("Learner seat revoked.");}
    catch(err){showMessage(err?.message||"Unable to revoke learner seat.",true);btn.disabled=false}
  }
  async function load(){const result=await call({action:"workspace"});purchases=Array.isArray(result.purchases)?result.purchases:[];render()}

  async function init(){
    renderShell();bindShell();startClock();
    const {data,error}=await db.auth.getSession();if(error)throw error;
    if(!data?.session?.user?.id){location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-group-seats.html");return}
    try{await load()}catch(err){console.error("[LMS Group Seats]",err);document.getElementById("content").innerHTML=`<div class="panel"><div class="empty">${esc(err?.message||"Unable to load group seats.")}</div></div>`}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
