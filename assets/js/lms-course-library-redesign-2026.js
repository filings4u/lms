/* screenings4u LMS — Complete Published Course Library */
(function(){
  "use strict";

  let db;
  let courses=[];
  const productByCourse=new Map();

  document.addEventListener("DOMContentLoaded",()=>init().catch(showError));

  async function init(){
    if(!window.LMS?.ready) throw new Error("Shared LMS authentication is unavailable.");
    ({client:db}=await window.LMS.ready);

    const courseResult=await db
      .from("lms_courses")
      .select("*")
      .eq("status","published")
      .order("published_at",{ascending:false});
    if(courseResult.error) throw courseResult.error;
    courses=courseResult.data||[];

    await loadCatalogProducts();

    populateCategories();
    bindControls();
    render();
    document.getElementById("coursesLoading")?.setAttribute("hidden","");
  }

  async function loadCatalogProducts(){
    if(!courses.length) return;
    try{
      const productResult=await db
        .from("lms_training_products")
        .select("id,course_id,name,product_kind,active,metadata")
        .in("course_id",courses.map(c=>c.id))
        .eq("active",true)
        .eq("product_kind","course");
      if(productResult.error||!productResult.data?.length) return;

      const products=productResult.data;
      const priceResult=await db
        .from("lms_training_prices")
        .select("product_id,amount,currency,active,effective_from")
        .in("product_id",products.map(p=>p.id))
        .eq("active",true);
      const prices=priceResult.error?[]:(priceResult.data||[]);

      products.forEach(product=>{
        const productPrices=prices
          .filter(p=>p.product_id===product.id)
          .sort((a,b)=>new Date(b.effective_from||0)-new Date(a.effective_from||0));
        productByCourse.set(product.course_id,{...product,price:productPrices[0]||null});
      });
    }catch(error){
      console.warn("[LMS Course Library] Product details were unavailable.",error);
    }
  }

  function categoryFor(course){
    const product=productByCourse.get(course.id);
    const fromProduct=product?.metadata?.category;
    if(fromProduct) return String(fromProduct);
    const title=String(course.title||"").toLowerCase();
    if(title.includes("dot")||title.includes("specimen collector")) return "DOT Specimen Collector Training";
    return "Professional Training";
  }

  function detailUrl(course){
    return "lms-course-details.html?course="+encodeURIComponent(course.id);
  }

  function catalogState(){
    return {label:"Available",className:"",action:"View Course"};
  }

  function plainText(value){
    const html=String(value||"");
    const el=document.createElement("div");
    el.innerHTML=html;
    return (el.textContent||el.innerText||"").replace(/\s+/g," ").trim();
  }

  function descriptionFor(course){
    const text=plainText(course.short_description||course.description||"");
    return text||"Open the course to review training details, requirements, and learning objectives.";
  }

  function formatPrice(course){
    const price=productByCourse.get(course.id)?.price;
    if(!price||price.amount==null) return null;
    const currency=String(price.currency||"usd").toUpperCase();
    try{
      return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(Number(price.amount));
    }catch(_){
      return "$"+Number(price.amount).toFixed(2);
    }
  }

  function populateCategories(){
    const select=document.getElementById("courseCategory");
    if(!select) return;
    const categories=[...new Set(courses.map(categoryFor))].filter(Boolean).sort();
    select.innerHTML='<option value="all">All Categories</option>'+categories.map(category=>
      '<option value="'+escapeHtml(category)+'">'+escapeHtml(category)+'</option>'
    ).join("");
  }

  function bindControls(){
    document.getElementById("courseSearch")?.addEventListener("input",render);
    document.getElementById("courseCategory")?.addEventListener("change",render);
    document.getElementById("courseSort")?.addEventListener("change",render);
    document.getElementById("coursesClearFilters")?.addEventListener("click",()=>{
      document.getElementById("courseSearch").value="";
      document.getElementById("courseCategory").value="all";
      document.getElementById("courseSort").value="newest";
      render();
    });
  }

  function render(){
    const search=(document.getElementById("courseSearch")?.value||"").trim().toLowerCase();
    const category=document.getElementById("courseCategory")?.value||"all";
    const sort=document.getElementById("courseSort")?.value||"newest";

    const filtered=courses.filter(course=>{
      const cat=categoryFor(course);
      const haystack=[course.title,course.short_description,plainText(course.description),cat].join(" ").toLowerCase();
      return (category==="all"||cat===category)&&(!search||haystack.includes(search));
    });

    filtered.sort((a,b)=>{
      if(sort==="title-asc") return String(a.title||"").localeCompare(String(b.title||""));
      if(sort==="title-desc") return String(b.title||"").localeCompare(String(a.title||""));
      return new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0);
    });

    const grid=document.getElementById("coursesGrid");
    if(grid) grid.innerHTML=filtered.map(renderCard).join("");

    const allCount=courses.length;
    const categoryCount=new Set(courses.map(categoryFor)).size;
    const selfPacedCount=courses.filter(course=>String(course.pace||"").toLowerCase()==="self_paced").length;
    setText("availableCourseCount",allCount);
    setText("catalogCourseCount",allCount);
    setText("catalogCategoryCount",categoryCount);
    setText("catalogSelfPacedCount",selfPacedCount);
    setText("coursesResultsCount",filtered.length+" course"+(filtered.length===1?"":"s"));

    const empty=document.getElementById("coursesEmpty");
    if(empty) empty.hidden=filtered.length!==0;
  }

  function renderCard(course){
    const state=catalogState();
    const product=productByCourse.get(course.id);
    const price=formatPrice(course);
    const pace=String(course.pace||"").toLowerCase()==="self_paced"?"Self-paced":"Instructor-led";
    const accessText=product?.metadata?.results||((course.time_limit_days?String(course.time_limit_days)+"-day access":"Course access"));

    return `
      <article class="course-card">
        <div class="course-card-visual" aria-hidden="true">
          <span class="course-card-icon">
            <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path><path d="M4 5.5v16"></path><path d="M8 8h8"></path><path d="M8 12h6"></path></svg>
          </span>
        </div>
        <div class="course-card-body">
          <div class="course-card-topline">
            <span class="course-card-category">${escapeHtml(categoryFor(course))}</span>
            <span class="course-card-state ${state.className}">${escapeHtml(state.label)}</span>
          </div>
          <h3 class="course-card-title">${escapeHtml(course.title||"Untitled Course")}</h3>
          <p class="course-card-description">${escapeHtml(descriptionFor(course))}</p>
          <div class="course-card-meta">
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path></svg>${escapeHtml(pace)}</span>
            <span><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path><path d="M4 5.5v16"></path></svg>${escapeHtml(accessText)}</span>
          </div>
          <div class="course-card-footer">
            <span class="course-card-price ${price?'':'muted'}">${escapeHtml(price||"View course details")}</span>
            <a class="course-card-action" href="${detailUrl(course)}">${escapeHtml(state.action)}<svg viewBox="0 0 24 24"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></a>
          </div>
        </div>
      </article>`;
  }

  function setText(id,value){
    const el=document.getElementById(id);
    if(el) el.textContent=String(value);
  }

  function escapeHtml(value){
    return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function showError(error){
    console.error("[LMS Course Library]",error);
    document.getElementById("coursesLoading")?.setAttribute("hidden","");
    const grid=document.getElementById("coursesGrid");
    if(grid) grid.innerHTML='<div class="courses-empty" style="grid-column:1/-1"><h3>Unable to load the course library</h3><p>'+escapeHtml(error?.message||"Please refresh the page and try again.")+'</p></div>';
    setText("coursesResultsCount","Unable to load");
  }
})();
