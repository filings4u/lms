(() => {
  "use strict";

  console.info("[LMS Account] build 20261004-training6");

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:"s4u-training-auth-session"}
  });

  const FONT_KEY="s4u_lms_font_size",FONT_DEFAULT=14,FONT_MIN=12,FONT_MAX=18,ACTIVE_NAV_INDEX=11;
  const navItems=[
    ["lms-dashboard.html","Dashboard","⌂"],["lms-my-courses.html","My Courses","▶"],["lms-courses.html","Course Library","▦"],["lms-progress.html","Progress","◉"],["lms-certificates.html","Certificates","✓"],["lms-live-training.html","Live Training","●"],["lms-my-appointments.html","Appointments","◷"],["lms-group-seats.html","Group Seats","♙"],["lms-documents.html","Documents","▤"],["lms-orders.html","Orders","≡"],["lms-notifications.html","Notifications","✉"],["lms-account.html","Account","○"],["lms-support.html","Support","?"]
  ];
  let currentUser=null,currentProfile=null;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const metric=(label,value,sub)=>`<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:""}</article>`;
  const fmtDate=v=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);};
  const readFontSize=()=>{const n=Number(localStorage.getItem(FONT_KEY));return Number.isFinite(n)?Math.min(FONT_MAX,Math.max(FONT_MIN,n)):FONT_DEFAULT;};
  function applyFontSize(n){const v=Math.min(FONT_MAX,Math.max(FONT_MIN,Number(n)||FONT_DEFAULT));document.documentElement.style.setProperty("--portal-font-root",v+"px");localStorage.setItem(FONT_KEY,String(v));const e=document.getElementById("fontSizeValue");if(e)e.textContent=v===FONT_DEFAULT?"Default":String(v);return v;}
  let portalFontSize=applyFontSize(readFontSize());

  function renderShell(){
    const links=navItems.map(([href,label,icon],i)=>`<a href="${href}"${i===ACTIVE_NAV_INDEX?' class="active" aria-current="page"':""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
    document.getElementById("trainingPortalApp").innerHTML=`<div class="app"><aside class="side" id="side"><div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div><nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav><div class="side-foot"><div style="font-size:.5625rem;color:#9fb3c7">Portal</div><div style="font-size:.6875rem;font-weight:800;color:#fff;margin-top:3px">lms.screenings4u.com</div></div></aside><main class="main"><header class="top"><div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button><div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Account</span></div></div><div class="top-right"><div class="top-utility-group top-time-group"><div class="portal-clock"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div><div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer"><button type="button" id="fontDown">A−</button><button type="button" class="font-reset" id="fontSizeValue">Default</button><button type="button" id="fontUp">A+</button></div></div><div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div></div></header><section class="mobile-nav" id="mobileNav" aria-hidden="true"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Account</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section><div class="content"><section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Account</h1><p>Manage your learner profile and account security.</p></section><section class="section" id="content"></section></div></main></div>`;
  }
  function bindShell(){
    document.getElementById("fontDown")?.addEventListener("click",()=>portalFontSize=applyFontSize(portalFontSize-1));document.getElementById("fontUp")?.addEventListener("click",()=>portalFontSize=applyFontSize(portalFontSize+1));document.getElementById("fontSizeValue")?.addEventListener("click",()=>portalFontSize=applyFontSize(FONT_DEFAULT));
    const menu=document.getElementById("menu"),mobile=document.getElementById("mobileNav");menu?.addEventListener("click",()=>{const open=!mobile.classList.contains("open");mobile.classList.toggle("open",open);document.body.classList.toggle("mobile-nav-open",open);menu.setAttribute("aria-expanded",String(open));mobile.setAttribute("aria-hidden",String(!open));});mobile?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{mobile.classList.remove("open");document.body.classList.remove("mobile-nav-open");menu?.setAttribute("aria-expanded","false");mobile.setAttribute("aria-hidden","true");}));document.getElementById("logout")?.addEventListener("click",async()=>{await db.auth.signOut();window.location.replace("https://lms.screenings4u.com/training-login.html");});
  }
  function startClock(){const update=()=>{const n=new Date(),d=document.getElementById("portalClockDate"),t=document.getElementById("portalClockTime");if(d)d.textContent=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(n);if(t)t.textContent=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(n);};update();window.__s4uLmsAccountClock=setInterval(update,1000);}

  async function loadProfile(){
    const {data,error}=await db.from("user_profiles").select("id,first_name,last_name,display_name,email,phone,status,metadata,created_at,updated_at").eq("id",currentUser.id).maybeSingle();
    if(error)throw error;
    currentProfile=data||{id:currentUser.id,first_name:"",last_name:"",display_name:"",email:currentUser.email||"",phone:"",status:"active",metadata:{}};
    render();
  }

  function render(){
    const p=currentProfile||{},m=(p.metadata&&typeof p.metadata==="object")?p.metadata:{};
    const email=currentUser.email||p.email||"";
    const verified=!!currentUser.email_confirmed_at;
    const status=String(p.status||"active").toLowerCase();
    const display=[p.first_name,p.last_name].filter(Boolean).join(" ")||p.display_name||email;
    document.getElementById("content").innerHTML=`
      <div class="metrics snapshot-metrics">${metric("Account Status",status==="active"?"Active":status,"Learner profile")}${metric("Email Verified",verified?"Yes":"No","Supabase Auth")}${metric("Member Since",fmtDate(currentUser.created_at)||"—","Account created")}${metric("Last Sign In",fmtDate(currentUser.last_sign_in_at)||"—","Latest authentication")}</div>
      <div class="section account-grid">
        <div class="account-card"><div class="account-card-head"><h2>Profile Information</h2><p>Keep your learner information current. Your name may be used on training records and certificates.</p></div><div class="account-card-body"><form id="profileForm"><div class="account-form-grid"><div class="account-field"><label for="firstName">First Name</label><input id="firstName" autocomplete="given-name" value="${esc(p.first_name||"")}"></div><div class="account-field"><label for="lastName">Last Name</label><input id="lastName" autocomplete="family-name" value="${esc(p.last_name||"")}"></div><div class="account-field full"><label for="email">Email Address</label><input id="email" type="email" readonly value="${esc(email)}"><small>Email changes are not handled from this learner profile page.</small></div><div class="account-field"><label for="phone">Phone Number</label><input id="phone" autocomplete="tel" value="${esc(p.phone||"")}"></div><div class="account-field"><label for="organization">Organization / Company</label><input id="organization" autocomplete="organization" value="${esc(m.company_name||"")}"></div></div><div id="profileMessage" class="account-message" role="status"></div><div class="account-actions"><button class="account-btn secondary" id="resetProfile" type="button">Reset</button><button class="account-btn primary" type="submit">Save Changes</button></div></form></div></div>
        <div class="account-card"><div class="account-card-head"><h2>Account Details</h2><p>Information tied to your signed-in Learning Center account.</p></div><div class="account-card-body"><div class="account-facts"><div class="account-fact"><span>Name</span><strong>${esc(display)}</strong></div><div class="account-fact"><span>Email</span><strong class="account-email">${esc(email)}</strong></div><div class="account-fact"><span>Role</span><strong>Learner</strong></div><div class="account-fact"><span>Status</span><strong class="account-status"><i class="account-status-dot"></i>${esc(status==="active"?"Active":status)}</strong></div><div class="account-fact"><span>Email verification</span><strong>${verified?"Verified":"Not verified"}</strong></div></div></div></div>
      </div>
      <div class="section account-grid">
        <div class="account-card"><div class="account-card-head"><h2>Security</h2><p>Change the password for your signed-in Learning Center account.</p></div><div class="account-card-body"><div class="security-note">Changing your password updates the credentials used for this Learning Center account. Your current session remains authenticated while the change is processed.</div><form id="passwordForm"><div class="account-form-grid"><div class="account-field"><label for="newPassword">New Password</label><input id="newPassword" type="password" autocomplete="new-password"></div><div class="account-field"><label for="confirmPassword">Confirm Password</label><input id="confirmPassword" type="password" autocomplete="new-password"></div></div><div id="passwordMessage" class="account-message" role="status"></div><div class="account-actions"><button class="account-btn primary" type="submit">Update Password</button></div></form></div></div>
        <div class="account-card"><div class="account-card-head"><h2>Account Services</h2><p>Related learner account tools.</p></div><div class="account-card-body"><div class="account-help"><a href="lms-notifications.html"><div>Notifications<br><span>Review Learning Center account updates</span></div><b>→</b></a><a href="lms-documents.html"><div>Documents<br><span>Review learner documents and submissions</span></div><b>→</b></a><a href="lms-support.html"><div>Support<br><span>Get help with your Learning Center account</span></div><b>→</b></a></div></div></div>
      </div>`;
    bindContent();
  }

  function message(id,text,bad=false){const el=document.getElementById(id);if(!el)return;el.textContent=text||"";el.className="account-message "+(text?(bad?"bad":"good"):"");}
  function bindContent(){
    document.getElementById("profileForm")?.addEventListener("submit",saveProfile);
    document.getElementById("resetProfile")?.addEventListener("click",render);
    document.getElementById("passwordForm")?.addEventListener("submit",changePassword);
  }
  async function saveProfile(event){
    event.preventDefault();message("profileMessage","");
    const first=document.getElementById("firstName").value.trim(),last=document.getElementById("lastName").value.trim(),phone=document.getElementById("phone").value.trim(),company=document.getElementById("organization").value.trim();
    if(!first||!last){message("profileMessage","First and last name are required.",true);return;}
    const button=event.submitter;if(button)button.disabled=true;
    try{
      const metadata={...((currentProfile?.metadata&&typeof currentProfile.metadata==="object")?currentProfile.metadata:{}),company_name:company||null};
      const payload={first_name:first,last_name:last,display_name:`${first} ${last}`.trim(),email:currentUser.email||currentProfile?.email||null,phone:phone||null,metadata,updated_at:new Date().toISOString()};
      const {data,error}=await db.from("user_profiles").update(payload).eq("id",currentUser.id).select("id,first_name,last_name,display_name,email,phone,status,metadata,created_at,updated_at").single();
      if(error)throw error;currentProfile=data;render();message("profileMessage","Account information saved.");
    }catch(error){console.error("[LMS Account] profile update",error);message("profileMessage",error?.message||"Unable to save account information.",true);}finally{if(button)button.disabled=false;}
  }
  async function changePassword(event){
    event.preventDefault();message("passwordMessage","");
    const password=document.getElementById("newPassword").value,confirm=document.getElementById("confirmPassword").value;
    if(password.length<8){message("passwordMessage","Password must be at least 8 characters.",true);return;}
    if(password!==confirm){message("passwordMessage","Passwords do not match.",true);return;}
    const button=event.submitter;if(button)button.disabled=true;
    try{const {error}=await db.auth.updateUser({password});if(error)throw error;document.getElementById("passwordForm").reset();message("passwordMessage","Password updated.");}
    catch(error){console.error("[LMS Account] password update",error);message("passwordMessage",error?.message||"Unable to update password.",true);}finally{if(button)button.disabled=false;}
  }
  function showError(error){console.error("[LMS Account]",error);const c=document.getElementById("content");if(c)c.innerHTML=`<div class="account-error">${esc(error?.message||"Unable to load account information.")}</div>`;}

  async function init(){renderShell();bindShell();startClock();const {data,error}=await db.auth.getSession();if(error)throw error;const session=data?.session;if(!session?.user?.id){window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-account.html");return;}currentUser=session.user;try{await loadProfile();}catch(error){showError(error);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
