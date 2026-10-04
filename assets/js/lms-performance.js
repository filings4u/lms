/* screenings4u Learning Center — lightweight performance layer */
(()=>{
  'use strict';
  const seen=new Set();
  const samePage=u=>u.origin===location.origin&&/\.html$/i.test(u.pathname);
  function prefetch(href){
    try{
      const u=new URL(href,location.href);
      if(!samePage(u))return;
      const key=u.pathname+u.search;
      if(seen.has(key))return;
      seen.add(key);
      fetch(u.href,{credentials:'same-origin',cache:'force-cache',priority:'low'}).catch(()=>seen.delete(key));
    }catch{}
  }
  document.addEventListener('pointerover',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},{capture:true,passive:true});
  document.addEventListener('focusin',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},true);
  document.addEventListener('touchstart',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},{capture:true,passive:true});
  addEventListener('load',()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('./lms-sw.js?v=20261003-1',{scope:'./'}).catch(()=>{});},{once:true});
})();
