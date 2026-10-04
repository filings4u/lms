/* SOURCE: assets/js/supabase-config.js */
/* SCREENINGS4U — TRAINING SUPABASE CONFIG — SESSION STORAGE ONLY */
(() => {
  "use strict";

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";

  window.SCREENINGS4U_SUPABASE_URL = SUPABASE_URL;
  window.SCREENINGS4U_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  if (
    !window.screenings4uSupabase &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    window.screenings4uSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage,
          storageKey: "s4u-training-auth-session"
        }
      }
    );
  }

  window.supabaseClient = window.screenings4uSupabase;

  window.getScreenings4uSupabase = function () {
    if (window.screenings4uSupabase) {
      return window.screenings4uSupabase;
    }

    throw new Error(
      "Supabase client is not initialized. Load @supabase/supabase-js before supabase-config.js."
    );
  };
})();


/* SOURCE: assets/js/lms-checkout.js?v=20260924-lms-checkout-prefill-1 */
(function(){
'use strict';
const STRIPE_KEY=window.SCREENINGS4U_STRIPE_PUBLISHABLE_KEY||'pk_live_51U8CQJEHE8bc4Otur9RVR1HsajJbmSbmRr5z0jGw1v5jgrKrzmnaaRTIV5v5CbEZIwFJLujrU0AI3lOZFDaNg4CG005XAPqkx3';
let stripe,elements,paymentElement,orderId,courseId,productSlug,enrollmentId;
let appliedDiscountCode="";
const $=id=>document.getElementById(id);
const COURSE_DETAILS={
'57d40c19-6232-4e18-88fc-e864f4aa855d':{title:'DOT Specimen Collector Training',price:320,summary:'Self-paced DOT collector training covering 49 CFR Part 40, collection procedures, documentation and required mock collections.',items:['3 hours of structured DOT Specimen Collector Training','5 DOT online video mock collections','49 CFR Part 40-focused curriculum','DOT collector requirements and responsibilities','Collection site security and required supplies','Custody & Control Form (CCF) completion','Urine specimen collection procedures','Monitored and direct observation collections','Shy bladder and problem specimen procedures','Training materials, guides and forms','Completion certificate after five error-free mock collections']},
'2718cf98-a318-42ee-bebc-ad5b9ee2b6de':{title:'DOT Urine Specimen Collector Training Plus Hair Collector Training',price:360,summary:'DOT Urine Specimen Collector Training plus Hair Collection Training in one package.',items:['Everything included in DOT Specimen Collector Training','5 DOT online video mock collections','Hair Drug Test Training','Hair specimen collection procedures','Urine and hair Chain of Custody procedures','DOT Specimen Collector Certificate pathway','Hair Collector Certificate','Training materials, guides and forms','60-day Learning Center access']},
'c454e0ec-3087-4388-a538-5a5c6bf1cf0d':{title:'DOT Specimen Collector Train the Trainer',price:550,summary:'DOT Specimen Collector Training plus trainer materials so you can train other collectors.',items:['Complete DOT Specimen Collector Training curriculum','5 error-free mock collection requirement','Instructor / trainer materials','Ability to train other collectors','Instructor Certificate','Chain of custody and specimen integrity procedures','Collection site security and donor confidentiality','Training materials, guides and forms','60-day Learning Center access']},
'd065de33-a16d-48de-ba0c-0a490b2039f1':{title:'DOT Specimen Collector Train the Trainer Plus Hair Collector Training',price:600,summary:'Train-the-Trainer program plus Hair Collector Training and Hair Collector Certificate.',items:['Everything in DOT Specimen Collector Train the Trainer','Instructor / trainer materials','Ability to train other collectors','Instructor Certificate','Hair Drug Test Training','Hair specimen collection procedures','Hair Collector Certificate','5 error-free DOT mock collections','Training materials, guides and forms','60-day Learning Center access']}
};
const SUPPLIES_DETAILS={title:'Specimen Collector Training Supplies',price:75,summary:'The supplies DOT Specimen Collector Training students need to complete their five required mock collections.',items:['5 DOT Collection Kits','10 Federal Custody and Control Forms (CCFs)','Mock Collection Checklist - Digital Download','Mock Procedures - Digital Download','Collection Site Security - Digital Download','Memorandum for Record - Digital Download','1 Ball Point Pen','2 Pair of NON Latex Gloves']};
const GROUP_DETAILS={
'dot_specimen_group_5':{title:'DOT Collector Group Training — Team 5',price:1500,seats:5,accessDays:60,summary:'Five DOT Specimen Collector Training seats for one organization.',items:['5 learner seats','60-day access per learner','DOT Specimen Collector Training curriculum','5 required mock collections per learner','Training materials, guides and forms','Completion certificate pathway','Centralized group seat purchase']},
'dot_specimen_group_10':{title:'DOT Collector Group Training — Team 10',price:2800,seats:10,accessDays:60,summary:'Ten DOT Specimen Collector Training seats with volume pricing for one organization.',items:['10 learner seats','60-day access per learner','DOT Specimen Collector Training curriculum','5 required mock collections per learner','Training materials, guides and forms','Completion certificate pathway','Centralized group seat purchase']},
'dot_specimen_group_25':{title:'DOT Collector Group Training — Team 25',price:6250,seats:25,accessDays:60,summary:'Twenty-five DOT Specimen Collector Training seats for larger teams and organizations.',items:['25 learner seats','60-day access per learner','DOT Specimen Collector Training curriculum','5 required mock collections per learner','Training materials, guides and forms','Completion certificate pathway','Centralized group seat purchase']},
};
function preloadDetails(){
 const list=$('courseIncludes');
 if(window.trainingServiceId==='specimen_collector_training_supplies'){
  const d=SUPPLIES_DETAILS;$('courseName').textContent=d.title;$('courseSummary').textContent=d.summary;$('coursePrice').textContent=money(d.price,'usd');$('accessLine').textContent='Physical kit + digital downloads';$('requirementsBlock').style.display='none';list.innerHTML=d.items.map(x=>'<li>'+x+'</li>').join('');return;
 }
 if(productSlug==='training_course_extension_30_days'){
  $('courseName').textContent='30-Day Course Access Extension';$('courseSummary').textContent='Adds 30 days automatically to the exact course enrollment you opened this checkout from.';$('coursePrice').textContent=money(100,'usd');$('accessLine').textContent='30 additional days';$('requirementsBlock').style.display='none';list.innerHTML='<li>30 additional days added automatically after successful payment</li><li>Applied only to your existing enrollment</li><li>No course selection or manual processing required</li><li>Updated expiration date appears in My Courses</li>';return;
 }
 if(GROUP_DETAILS[productSlug]){const g=GROUP_DETAILS[productSlug];$('courseName').textContent=g.title;$('courseSummary').textContent=g.summary;$('coursePrice').textContent=money(g.price,'usd');$('accessLine').textContent=g.seats+' learner seat'+(g.seats===1?'':'s')+' · '+g.accessDays+'-day access per learner';$('requirementsBlock').style.display='none';list.innerHTML=g.items.map(x=>'<li>'+x+'</li>').join('');const n=$('groupNote');if(n){n.style.display='block';n.textContent=g.seats===1?'This hidden service is for live checkout testing only.':'After payment, the purchased seats are recorded with the group-training order for assignment to your team.';}return;}
 const d=COURSE_DETAILS[courseId];
 if(!d){$('courseName').textContent='Training course';$('courseSummary').textContent='Course details could not be loaded. Please return to Training Options and select the course again.';list.innerHTML='<li>Unable to identify this training course.</li>';return;}
 $('courseName').textContent=d.title;$('courseSummary').textContent=d.summary;$('coursePrice').textContent=money(d.price,'usd');$('accessLine').textContent='Single learner · 60-day access';list.innerHTML=d.items.map(x=>'<li>'+x+'</li>').join('');
}
function renderDetails(data){const list=$('courseIncludes');const p=data.product||{};const g=GROUP_DETAILS[p.slug||productSlug];if(g){$('courseName').textContent=p.name||g.title;$('courseSummary').textContent=p.description||g.summary;$('coursePrice').textContent=money(data.total,data.currency);$('accessLine').textContent=g.seats+' learner seat'+(g.seats===1?'':'s')+' · '+g.accessDays+'-day access per learner';$('requirementsBlock').style.display='none';list.innerHTML=g.items.map(x=>'<li>'+x+'</li>').join('');const n=$('groupNote');if(n){n.style.display='block';n.textContent=g.seats===1?'This hidden service is for live checkout testing only.':'After payment, the purchased seats are recorded with the group-training order for assignment to your team.';}return;}if(p.kind==='extension'){const t=data.targetEnrollment||{};$('courseName').textContent='30-Day Course Access Extension';$('courseSummary').textContent='Your extension will be applied automatically to '+(t.courseName||'your enrolled course')+'.';$('coursePrice').textContent=money(data.total,data.currency);$('accessLine').textContent='30 additional days';$('requirementsBlock').style.display='none';list.innerHTML='<li>30 additional days of access</li><li>Automatically applied after payment</li><li>Current progress and course history stay intact</li><li>New access date appears in My Courses</li>';const n=$('extensionNote');n.style.display='block';n.innerHTML='<strong>Extending this enrollment</strong>'+(t.courseName||'Your course')+(t.expiresAt?' · Current access through '+new Date(t.expiresAt).toLocaleDateString():'');return;}if(p.kind==='group'){ $('courseName').textContent=p.name;$('courseSummary').textContent=p.description||'Group DOT Specimen Collector Training seats.';$('coursePrice').textContent=money(data.total,data.currency);$('accessLine').textContent=(p.seatCount||1)+' learner seats · '+(p.accessDays||60)+'-day access per learner';$('requirementsBlock').style.display='none';list.innerHTML=['DOT Specimen Collector Training access for '+(p.seatCount||1)+' learners','60-day access per learner','5 required mock collections per learner','Completion certificate pathway','Centralized group seat purchase'].map(x=>'<li>'+x+'</li>').join('');const n=$('groupNote');n.style.display='block';n.textContent='After purchase, your '+(p.seatCount||1)+' training seats will be available for assignment through the screenings4u training system.';return;}if(p.kind==='supplies'&&p.metadata?.category==='training_access'){ $('courseName').textContent=p.name||'Training Purchase';$('courseSummary').textContent=p.description||'Training access purchase.';$('accessLine').textContent=(p.seatCount||1)+' learner seat'+((p.seatCount||1)===1?'':'s');$('requirementsBlock').style.display='none';const items=p.metadata?.includes||[];list.innerHTML=items.map(x=>'<li>'+x+'</li>').join('');return;}if(p.kind==='supplies'){ $('courseName').textContent=p.name||'Collector Training Supplies';$('courseSummary').textContent=p.description||'Collector training supplies for required mock collections.';$('accessLine').textContent='Physical kit + digital downloads';$('requirementsBlock').style.display='none';const items=p.metadata?.includes||[];list.innerHTML=items.map(x=>'<li>'+x+'</li>').join('');return;}const d=COURSE_DETAILS[p.courseId||courseId];if(d){$('courseSummary').textContent=d.summary;list.innerHTML=d.items.map(x=>'<li>'+x+'</li>').join('');}$('accessLine').textContent='Single learner · '+(p.accessDays||60)+'-day access';}

function status(msg,type='err'){const el=$('status');el.textContent=msg||'';el.className='checkout-error'+((msg&&type==='err')?' show':'');if(msg&&type==='ok')el.className='checkout-status';if(!msg)el.className='checkout-error';}
function money(n,c='usd'){return new Intl.NumberFormat('en-US',{style:'currency',currency:String(c).toUpperCase()}).format(Number(n||0));}
async function session(){try{const c=await window.getScreenings4uSupabase?.();if(!c)return {client:null,session:null};const r=await c.auth.getSession();return {client:c,session:r.data?.session||null};}catch{return {client:null,session:null}}}
function setDiscountMessage(message,type=''){const el=$('discountMessage');if(!el)return;el.textContent=message||'';el.className='discount-message'+(type?' '+type:'');}
function renderTotals(data){const box=$('checkoutTotals');if(!box)return;const subtotal=Number(data?.subtotal ?? data?.total ?? 0),discount=Number(data?.discountAmount||0),total=Number(data?.total ?? subtotal-discount),currency=data?.currency||'usd';$('subtotalDisplay').textContent=money(subtotal,currency);$('totalDisplay').textContent=money(total,currency);const row=$('discountTotalRow');if(discount>0){row.style.display='flex';$('discountDisplay').textContent='−'+money(discount,currency)}else{row.style.display='none'}box.style.display='block';}
async function validateDiscountCode(){const code=($('discountCode')?.value||'').trim().toUpperCase();if(!code){appliedDiscountCode='';setDiscountMessage('Enter a discount code.','err');return false;}try{const auth=await session(),headers={'Content-Type':'application/json','apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY};if(auth.session?.access_token)headers.Authorization='Bearer '+auth.session.access_token;setDiscountMessage('Checking code…');$('applyDiscount').disabled=true;const r=await fetch(window.SCREENINGS4U_SUPABASE_URL+'/functions/v1/validate-discount-code',{method:'POST',headers,body:JSON.stringify({code,courseId,trainingProduct:productSlug,customerEmail:$('email').value.trim(),channel:'training'})});const d=await r.json();if(!r.ok||!d.valid)throw new Error(d.message||d.error||'That discount code is not valid.');appliedDiscountCode=code;setDiscountMessage((d.name||code)+' applied: '+money(d.discountAmount,d.currency||'usd')+' off.','ok');return true;}catch(e){appliedDiscountCode='';setDiscountMessage(e.message||'Unable to validate discount code.','err');return false;}finally{$('applyDiscount').disabled=false;}}
function fillIfEmpty(id,value){const el=$(id);if(el&&!String(el.value||'').trim()&&value!=null)el.value=String(value);}
async function prefillCustomer(auth){
 if(!auth?.session?.user)return;
 const user=auth.session.user;
 fillIfEmpty('email',user.email||'');
 if($('email'))$('email').readOnly=true;
 const meta=user.user_metadata||{};
 fillIfEmpty('firstName',meta.first_name||meta.firstName||'');
 fillIfEmpty('lastName',meta.last_name||meta.lastName||'');
 fillIfEmpty('phone',meta.phone||'');
 if(!auth.client)return;
 try{
  const r=await auth.client.from('user_profiles').select('first_name,last_name,email,phone,address_line_1,address_line_2,city,state,postal_code').eq('id',user.id).maybeSingle();
  if(r.error)throw r.error;
  const p=r.data||{};
  fillIfEmpty('firstName',p.first_name||'');
  fillIfEmpty('lastName',p.last_name||'');
  fillIfEmpty('email',p.email||user.email||'');
  fillIfEmpty('phone',p.phone||'');
  fillIfEmpty('address',p.address_line_1||'');
  fillIfEmpty('address2',p.address_line_2||'');
  fillIfEmpty('city',p.city||'');
  fillIfEmpty('state',p.state||'');
  fillIfEmpty('zip',p.postal_code||'');
 }catch(e){console.warn('Unable to prefill Learning Center checkout profile.',e);}
}
function firstMissingRequired(){
 const required=[['firstName','first name'],['lastName','last name'],['email','email address'],['address','billing address'],['city','city'],['state','state'],['zip','ZIP code']];
 for(const [id,label] of required){const el=$(id);if(!el||!String(el.value||'').trim())return {id,label,el};}
 return null;
}
async function continueToPayment(){
 const auth=await session();
 if(productSlug==='training_course_extension_30_days'&&!auth.session){location.href='training-login.html?return='+encodeURIComponent(location.pathname+location.search);return;}
 await prefillCustomer(auth);
 const missing=firstMissingRequired();
 if(missing){status('Enter your '+missing.label+' to continue.');missing.el?.focus();return;}
 $('payButton').disabled=true;
 await initialize(auth);
}
async function start(){
 const params=new URLSearchParams(location.search);courseId=params.get('course')||'';productSlug=params.get('product')||params.get('service')||'';enrollmentId=params.get('enrollment')||params.get('enrollment_id')||'';window.trainingServiceId=productSlug;if($('applyDiscount'))$('applyDiscount').onclick=validateDiscountCode;
 if(!courseId&&!productSlug){status('No training course or product was selected.');return;}
 if(productSlug==='training_course_extension_30_days'&&!enrollmentId){status('Open My Courses and use Extend on the course you want to extend.');$('payButton').disabled=true;return;}
 preloadDetails();
 const auth=await session();
 if(productSlug==='training_course_extension_30_days'&&!auth.session){location.href='training-login.html?return='+encodeURIComponent(location.pathname+location.search);return;}
 await prefillCustomer(auth);
 $('payButton').disabled=false;
 $('payButton').textContent='Continue to Payment';
 $('payButton').onclick=continueToPayment;
 status('');
}
async function initialize(auth){
 try{
  status('Preparing secure checkout...','ok');
  const headers={'Content-Type':'application/json','apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY};
  if(auth.session?.access_token)headers.Authorization='Bearer '+auth.session.access_token;
  const missing=firstMissingRequired();if(missing){missing.el?.focus();throw new Error('Enter your '+missing.label+' to continue.');}const r=await fetch(window.SCREENINGS4U_SUPABASE_URL+'/functions/v1/lms-create-payment-intent',{method:'POST',headers,body:JSON.stringify({courseId,product:productSlug,enrollmentId,discountCode:appliedDiscountCode||(($('discountCode')?.value||'').trim().toUpperCase()),customer:{firstName:$('firstName').value.trim(),lastName:$('lastName').value.trim(),email:$('email').value.trim(),phone:$('phone').value.trim()},billing:{line1:$('address').value.trim(),line2:$('address2').value.trim(),city:$('city').value.trim(),state:$('state').value.trim(),postalCode:$('zip').value.trim()}})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){if(data.alreadyEnrolled){location.href='lms-my-courses.html';return;}const detail=data.stage?(' ['+data.stage+']'):'';console.error('lms-create-payment-intent failed',data);throw new Error((data.error||'Unable to start checkout.')+detail);}
  orderId=data.orderId;renderTotals(data);if(data.discountCode){appliedDiscountCode=data.discountCode;$('discountCode').value=data.discountCode;setDiscountMessage(data.discountCode+' applied.','ok');}$('courseName').textContent=data.product?.name||'Training Purchase';$('coursePrice').textContent=money(data.total,data.currency);renderDetails(data);if(data.customerEmail){$('email').value=data.customerEmail;$('email').readOnly=true;}
  if(!window.Stripe)throw new Error('Stripe.js did not load. Refresh the page and try again.');
  if(!data.clientSecret)throw new Error('Stripe did not return a payment client secret.');
  stripe=Stripe(STRIPE_KEY);
  if(paymentElement){try{paymentElement.destroy();}catch{}}
  elements=stripe.elements({clientSecret:data.clientSecret,appearance:{theme:'stripe',variables:{colorPrimary:'#ff6500',borderRadius:'9px'}}});
  paymentElement=elements.create('payment');
  paymentElement.mount('#payment-element');
  const paymentSection=$('stripePaymentSection');if(paymentSection){paymentSection.classList.remove('hidden');paymentSection.setAttribute('aria-hidden','false');}
  const actionLabel=productSlug==='training_course_extension_30_days'?'Extend Course':(data.product?.metadata?.category==='training_access'?'Complete Purchase':(data.product?.kind==='supplies'?'Complete Order':(data.product?.kind==='group'?'Purchase Seats':'Enroll')));$('payButton').disabled=false;$('payButton').textContent='Pay '+money(data.total,data.currency)+' & '+actionLabel;$('payButton').onclick=pay;$('status').className='checkout-error';$('status').textContent='';
 }catch(e){console.error(e);const paymentSection=$('stripePaymentSection');if(paymentSection){paymentSection.classList.add('hidden');paymentSection.setAttribute('aria-hidden','true');}status(e.message||'Unable to load checkout.');$('payButton').disabled=false;$('payButton').textContent='Continue to Payment';}
}
async function pay(){
 if(!stripe||!elements){status('Secure payment is not ready yet.');return;}
 $('payButton').disabled=true;status('Processing payment...','ok');
 try{
  const result=await stripe.confirmPayment({elements,confirmParams:{return_url:new URL('success.html?order='+encodeURIComponent(orderId),location.origin+'/').href}});
  if(result.error){console.error('Stripe confirmPayment error',result.error);status(result.error.message||'Payment could not be completed.');$('payButton').disabled=false;}
 }catch(e){console.error('Stripe payment confirmation failed',e);status(e?.message||'Payment could not be completed.');$('payButton').disabled=false;}
}
document.addEventListener('DOMContentLoaded',start);
})();
