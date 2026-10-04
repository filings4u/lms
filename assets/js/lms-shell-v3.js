(function(){
  'use strict';
  const page=(location.pathname.split('/').pop()||'lms-dashboard.html').toLowerCase();
  const titles={
    'lms-dashboard.html':'Home','lms-my-courses.html':'My Learning','lms-courses.html':'Course Library',
    'lms-course-details.html':'Course Details','lms-progress.html':'Progress','lms-certificates.html':'Certificates',
    'lms-documents.html':'Documents','lms-orders.html':'Orders','lms-live-training.html':'Live Training',
    'lms-my-appointments.html':'My Appointments','lms-schedule-appointment.html':'Schedule Appointment',
    'lms-customer-scheduling.html':'Scheduling','lms-support.html':'Training Support','lms-notifications.html':'Notifications',
    'lms-account.html':'Account','lms-quiz.html':'Knowledge Check','lms-assessment.html':'Assessment'
  };
  if(page==='lms-welcome.html'){
    // Welcome is a standalone onboarding shell. lms-shell-v2 creates the brand bar.
    // Do not observe/mutate it continuously: that can create a self-triggering DOM loop.
    const setWelcome=()=>{
      const b=document.querySelector('.onboard-brandbar b');
      if(b && b.textContent !== 'New Learner Orientation') b.textContent='New Learner Orientation';
    };
    setWelcome();
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setWelcome,{once:true});
    return;
  }
  function install(){
    const left=document.querySelector('.lms-topbar-left'); if(!left||left.querySelector('.s4u-page-title'))return;
    const title=document.createElement('span'); title.className='s4u-page-title';
    title.textContent=titles[page]||document.title.split('|')[0].trim()||'Learning Center';
    left.appendChild(title);
  }
  install(); new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
