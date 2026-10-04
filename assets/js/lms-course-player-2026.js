(function(){
  'use strict';
  function init(){
    document.body.classList.add('lms-course-player-immersive');
    var toggle=document.querySelector('[data-curriculum-toggle]');
    var aside=document.querySelector('.course-player-sidebar');
    if(toggle&&aside){
      toggle.addEventListener('click',function(){
        var open=document.body.classList.toggle('course-curriculum-open');
        toggle.setAttribute('aria-expanded',open?'true':'false');
      });
      aside.addEventListener('click',function(e){
        if(window.innerWidth<=900 && e.target.closest('.course-player-lesson-link')){
          document.body.classList.remove('course-curriculum-open');
          toggle.setAttribute('aria-expanded','false');
        }
      });
      document.addEventListener('keydown',function(e){
        if(e.key==='Escape'){
          document.body.classList.remove('course-curriculum-open');
          toggle.setAttribute('aria-expanded','false');
        }
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
