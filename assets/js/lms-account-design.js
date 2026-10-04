/* Screenings4u Learning Center — My Account page UI only.
   Account data/save logic remains in lms-account.js. */
(function(){
  'use strict';
  function init(){
    const links=[...document.querySelectorAll('.account-nav a[href^="#"]')];
    const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
    function setActive(id){links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id));}
    links.forEach(a=>a.addEventListener('click',function(){const id=this.getAttribute('href').slice(1);setActive(id);}));
    if('IntersectionObserver' in window && sections.length){
      const observer=new IntersectionObserver(entries=>{
        const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
        if(visible) setActive(visible.target.id);
      },{rootMargin:'-20% 0px -65% 0px',threshold:[0,.2,.5]});
      sections.forEach(s=>observer.observe(s));
    }
    const form=document.querySelector('.account-form');
    if(form){
      form.addEventListener('reset',()=>setTimeout(()=>{document.activeElement&&document.activeElement.blur();},0));
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
