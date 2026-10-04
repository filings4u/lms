(() => {
  "use strict";
  const money=(n,c="usd")=>new Intl.NumberFormat("en-US",{style:"currency",currency:String(c||"usd").toUpperCase(),maximumFractionDigits:0}).format(Number(n||0));
  async function load(){
    try{
      const base=String(window.SCREENINGS4U_SUPABASE_URL||"").replace(/\/$/,"");
      const key=window.SCREENINGS4U_SUPABASE_ANON_KEY||"";
      if(!base||!key)return;
      const r=await fetch(base+"/functions/v1/public-training-catalog",{method:"POST",headers:{"Content-Type":"application/json","apikey":key},body:"{}",cache:"no-store"});
      const d=await r.json().catch(()=>({})); if(!r.ok||!Array.isArray(d.products))return;
      const bySlug=new Map(d.products.map(p=>[String(p.slug),p]));
      const byCourse=new Map(d.products.filter(p=>p.courseId).map(p=>[String(p.courseId),p]));
      document.querySelectorAll('a[href*="lms-checkout.html"]').forEach(a=>{
        try{
          const u=new URL(a.getAttribute("href"),location.href),slug=u.searchParams.get("product")||u.searchParams.get("service"),course=u.searchParams.get("course");
          const p=(slug&&bySlug.get(slug))||(course&&byCourse.get(course)); if(!p||p.price==null)return;
          const card=a.closest("article,.training-card,.pricing-card,.price-card,.course-card,.group-card,.training-option")||a.parentElement;
          const price=card?.querySelector?.('.training-price,.training-info-price,.ext-price,.price,.pricing-price,[data-training-price]'); if(price)price.textContent=money(p.price,p.currency);
          const per=card?.querySelector?.('.pricing-per');if(per&&p.kind==='group'&&Number(p.seatCount)>0)per.textContent=money(Number(p.price)/Number(p.seatCount),p.currency)+' per learner';
          if(/enroll for \$/i.test(a.textContent||""))a.textContent="Enroll for "+money(p.price,p.currency);
          a.dataset.trainingProduct=p.slug;
        }catch(_){ }
      });
      document.querySelectorAll('[data-training-product]').forEach(el=>{const p=bySlug.get(el.dataset.trainingProduct);if(!p||p.price==null)return;const price=el.querySelector?.('[data-training-price],.training-price,.training-info-price,.ext-price,.price,.pricing-price');if(price)price.textContent=money(p.price,p.currency);});
      window.S4UTrainingCatalog={products:d.products,bySlug,byCourse};
    }catch(e){console.warn("[Training storefront sync]",e);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();
