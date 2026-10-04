(() => {
  "use strict";
  const FONT_KEY = "s4u_training_font_size";
  const FONT_DEFAULT = 14, FONT_MIN = 12, FONT_MAX = 18;
  const clamp = n => Math.min(FONT_MAX, Math.max(FONT_MIN, Number(n) || FONT_DEFAULT));
  function applyFontSize(n){
    const v=clamp(n); document.documentElement.style.setProperty("--portal-font-root", v+"px");
    try{localStorage.setItem(FONT_KEY,String(v))}catch(_){}
    const label=document.getElementById("fontSizeValue"); if(label) label.textContent=v===FONT_DEFAULT?"Default":String(v); return v;
  }
  let size=FONT_DEFAULT; try{size=clamp(localStorage.getItem(FONT_KEY))}catch(_){} applyFontSize(size);
  function clock(){
    const d=document.getElementById("portalClockDate"), t=document.getElementById("portalClockTime"); if(!d||!t)return;
    const now=new Date(); d.textContent=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(now);
    t.textContent=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(now);
  }
  function init(){
    clock(); window.__s4uTrainingClock && clearInterval(window.__s4uTrainingClock); window.__s4uTrainingClock=setInterval(clock,1000);
    const menu=document.getElementById("menu"), mobile=document.getElementById("mobileNav");
    const setOpen=open=>{const next=!!open&&matchMedia("(max-width:820px)").matches; mobile?.classList.toggle("open",next); document.body.classList.toggle("mobile-nav-open",next); menu?.classList.toggle("open",next); menu?.setAttribute("aria-expanded",String(next)); mobile?.setAttribute("aria-hidden",String(!next));};
    menu?.addEventListener("click",()=>setOpen(!mobile?.classList.contains("open")));
    mobile?.addEventListener("click",e=>{if(e.target.closest("a"))setOpen(false)});
    addEventListener("resize",()=>{if(innerWidth>820)setOpen(false)},{passive:true}); document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
    document.getElementById("fontDown")?.addEventListener("click",()=>{size=applyFontSize(size-1)});
    document.getElementById("fontUp")?.addEventListener("click",()=>{size=applyFontSize(size+1)});
    document.getElementById("fontSizeValue")?.addEventListener("click",()=>{size=applyFontSize(FONT_DEFAULT)});
    document.getElementById("logout")?.addEventListener("click",async()=>{try{if(window.S4UAuth?.signOut){await window.S4UAuth.signOut("training-login.html"); return;}}catch(e){console.warn("[Training Shell] sign out failed",e)} location.href="training-login.html";});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
