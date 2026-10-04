(function(){
  'use strict';
  function render(){
    const host=document.getElementById('trainingSiteHeader');
    if(!host) return;
    host.className='training-site-header';
    const brandLogo = document.body.classList.contains('training-home-page') ? 'images/training-logo.png' : 'images/training-logo2.png';
    host.innerHTML=`
      <div class="training-shell training-header-inner">
        <a class="training-brand" href="index.html" aria-label="screenings4u Learning Center home">
          <img src="${brandLogo}" alt="screenings4u Learning Center">
        </a>
        <nav class="training-header-nav" aria-label="Learning Center navigation">
          <a href="index.html#courses">Training</a>
          <a href="dot-specimen-collector-training.html">Collector</a>
          <a href="der-training.html">DER</a>
          <a href="supervisor-training.html">Supervisor</a>
          <a href="employee-training.html">Employee</a>
          <a href="hazmat-training.html">HazMat</a>
          <a href="group-training.html">Group Training</a>
          <a href="collector-training-supplies.html">Training Supplies</a>
          <a href="index.html#faq">FAQ</a>
        </nav>
        <div class="training-header-actions">
          <a class="training-login-link" href="training-login.html">Student Login</a>
          <a class="training-button training-button-primary" href="index.html#courses">Enroll Now</a>
        </div>
      </div>`;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
})();
