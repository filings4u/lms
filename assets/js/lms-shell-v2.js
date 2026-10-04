(function(){
  'use strict';
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  if(page==='lms-welcome.html'){
    document.body.classList.add('lms-onboarding-mode');
    const app=document.querySelector('.lms-app');
    if(app && !document.querySelector('.onboard-brandbar')){
      const bar=document.createElement('div');
      bar.className='onboard-brandbar';
      bar.innerHTML='<img src="images/logo.png" alt="screenings4u"><span class="divider" aria-hidden="true"></span><span>Learning Center</span><b>New learner orientation</b>';
      app.parentNode.insertBefore(bar,app);
    }
    return;
  }
  // Normalize desktop toggle state after sidebar injection.
  function bindShellToggle(){
    const btn=document.querySelector('[data-lms-menu-toggle]');
    if(!btn||btn.dataset.shellV2Bound==='1') return;
    btn.dataset.shellV2Bound='1';
    if(innerWidth>860){
      let collapsed=false;try{collapsed=localStorage.getItem('s4u-lms-sidebar-collapsed')==='1'}catch(e){}
      document.body.classList.toggle('lms-nav-collapsed',collapsed);
      btn.setAttribute('aria-expanded',collapsed?'false':'true');
    }
  }
  bindShellToggle();
  new MutationObserver(bindShellToggle).observe(document.documentElement,{childList:true,subtree:true});
})();
