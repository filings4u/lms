/* ============================================================
   screenings4u — LMS Phase 3
   Lessons, content blocks, Supabase media, Cloudflare video IDs
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function db() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && window.SCREENINGS4U_SUPABASE_URL && window.SCREENINGS4U_SUPABASE_ANON_KEY) {
      window.supabaseClient = window.supabase.createClient(window.SCREENINGS4U_SUPABASE_URL, window.SCREENINGS4U_SUPABASE_ANON_KEY);
      return window.supabaseClient;
    }
    throw new Error('Supabase client is unavailable. Check assets/js/supabase-config.js.');
  }

  async function requireAdmin() {
    if (window.S4UAuth?.requireSession) return await window.S4UAuth.requireSession('admin-login.html');
    const { data } = await db().auth.getSession();
    if (!data?.session) { location.replace('admin-login.html'); return null; }
    return data.session;
  }

  function message(text, type='info') { if (window.S4UUI?.modal && (type==='success'||type==='error')) return window.S4UUI.modal({title:type==='success'?'Success':'Unable to Complete Action',message:text,type,confirmText:'Close'}); if (window.S4UUI?.toast) return window.S4UUI.toast(text,type); console.log('[LMS]',text); }
  function form(options){ if(window.S4UUI?.formModal) return window.S4UUI.formModal(options); return null; }
  function confirmAction(options){ if(window.S4UUI?.modal) return window.S4UUI.modal({...options,showCancel:true}); return null; }

  function lessonIdFromUrl() {
    const p = new URLSearchParams(location.search);
    return p.get('id') || p.get('lesson') || '';
  }

  async function initLessons() {
    const session = await requireAdmin(); if (!session) return;
    const client = db();
    const { data, error } = await client.from('lms_lessons').select(`
      id,title,status,estimated_minutes,is_required,updated_at,
      lms_sections(id,title,course_id,lms_courses(id,title))
    `).order('updated_at',{ascending:false});
    if (error) throw error;
    const lessons = data || [];
    const kpis = document.querySelectorAll('.lms-kpi strong');
    if (kpis[0]) kpis[0].textContent = lessons.length;
    if (kpis[1]) kpis[1].textContent = lessons.filter(x=>x.status==='published').length;
    if (kpis[2]) kpis[2].textContent = lessons.filter(x=>x.status==='draft').length;
    if (kpis[3]) kpis[3].textContent = '—';

    const list = document.querySelector('.lms-list');
    if (list) {
      list.innerHTML = lessons.length ? lessons.map((l,i)=>`
        <a class="lms-row" href="admin-lms-lesson-builder.html?id=${encodeURIComponent(l.id)}">
          <span class="lms-row-icon">${String(i+1).padStart(2,'0')}</span>
          <span><strong>${esc(l.title)}</strong><small>${esc(l.lms_sections?.lms_courses?.title || 'Unassigned course')} · ${esc(l.lms_sections?.title || 'No section')} · ${esc(l.status)}</small></span>
          <span class="lms-arrow">→</span>
        </a>`).join('') : '<div class="empty-media">No lessons yet. Create the first lesson from the Lesson Builder.</div>';
    }

    // Remove links to pages that are not part of the current LMS page set.
    document.querySelectorAll('a[href*="admin-lms-lessons-"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href !== 'admin-lms-lesson-builder.html') a.setAttribute('href','admin-lms-lessons.html');
    });
  }

  function blockTemplate(block={}, index=1) {
    const type = block.block_type || 'text';
    const isMedia = type === 'media' || type === 'video' || type === 'image' || type === 'document';
    const isLink = type === 'link' || type === 'external_link';
    let body = '';
    if (isMedia) body = `<div class="media-dropzone" data-media-id="${esc(block.media_id||'')}">
      <strong>${block.media_title ? esc(block.media_title) : 'No media selected'}</strong>
      <span>${block.media_id ? 'Media ID: '+esc(block.media_id) : 'Select an LMS media record.'}</span>
      <button type="button" class="lms-btn lms-btn-secondary select-media">Select Media</button>
    </div>`;
    else if (isLink) body = `<input class="block-external-url" type="url" placeholder="https://..." value="${esc(block.external_url||'')}">`;
    else body = `<textarea class="content-editor" placeholder="Enter lesson content here...">${esc(block.content||'')}</textarea>`;
    return `<article class="content-block" data-block-id="${esc(block.id||'')}" data-block-type="${esc(type)}">
      <div class="content-block-head"><span class="drag-handle">⋮⋮</span><span class="block-number">${index}</span>
      <div class="block-title-wrap"><div class="block-type">${esc(type.replace(/_/g,' '))}</div><div class="block-description">${esc(block.title || (isMedia?'Learning media':isLink?'External resource':'Written lesson content'))}</div></div>
      <div class="block-actions"><button type="button" class="icon-action move-up">↑</button><button type="button" class="icon-action move-down">↓</button><button type="button" class="icon-action delete-block">Delete</button></div></div>
      <div class="content-block-body"><input class="block-title-input" type="text" placeholder="Block title (optional)" value="${esc(block.title||'')}">${body}</div>
    </article>`;
  }

  function renumberBlocks() { document.querySelectorAll('#contentBlockList .content-block').forEach((b,i)=>{ const n=b.querySelector('.block-number'); if(n)n.textContent=i+1; }); }

  async function openMediaPicker(target) {
    const { data, error } = await db().from('lms_media').select('id,title,original_filename,media_type,provider,provider_video_id').order('created_at',{ascending:false}).limit(200);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) { message('No media records found. Add media first.','error'); return; }
    form({title:'Select Media',message:'Choose an LMS media record for this content block.',fields:[{name:'media_id',label:'Media',type:'select',options:rows.map(m=>({value:m.id,label:`${m.title||m.original_filename} · ${m.media_type}`}))}],confirmText:'Select',onSubmit:({media_id})=>{const media=rows.find(m=>m.id===media_id); if(!media)return; target.dataset.mediaId=media.id;target.querySelector('strong').textContent=media.title||media.original_filename;target.querySelector('span').textContent=`Media ID: ${media.id}${media.provider==='cloudflare'?' · Cloudflare video':''}`;}});
  }

  async function initLessonBuilder() {
    const session = await requireAdmin(); if (!session) return;
    const client = db();
    const list = $('contentBlockList'); if (!list) return;
    let currentId = lessonIdFromUrl();

    const [{data:courses,error:cErr},{data:sections,error:sErr}] = await Promise.all([
      client.from('lms_courses').select('id,title').order('title'),
      client.from('lms_sections').select('id,course_id,title').order('sort_order')
    ]);
    if(cErr) throw cErr; if(sErr) throw sErr;
    $('lessonCourse').innerHTML = '<option value="">Select course</option>'+(courses||[]).map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('');
    function renderSections(courseId, selected='') {
      const rows=(sections||[]).filter(s=>!courseId||s.course_id===courseId);
      $('lessonSection').innerHTML='<option value="">Select section</option>'+rows.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${esc(s.title)}</option>`).join('');
    }
    $('lessonCourse').addEventListener('change',()=>renderSections($('lessonCourse').value));

    if (currentId) {
      const {data:lesson,error} = await client.from('lms_lessons').select('*,lms_sections(course_id)').eq('id',currentId).single();
      if(error) throw error;
      $('lessonTitle').value=lesson.title||''; $('lessonDescription').value=lesson.description||'';
      $('lessonCourse').value=lesson.lms_sections?.course_id||''; renderSections($('lessonCourse').value,lesson.section_id);
      const {data:blocks,error:bErr}=await client.from('lms_content_blocks').select('*').eq('lesson_id',currentId).order('sort_order'); if(bErr)throw bErr;
      list.innerHTML=(blocks||[]).length ? blocks.map((b,i)=>blockTemplate(b,i+1)).join('') : '';
    } else { list.innerHTML=''; renderSections(''); }

    function addBlock(type='text') { list.insertAdjacentHTML('beforeend',blockTemplate({block_type:type},list.querySelectorAll('.content-block').length+1)); }
    $('addContentBlockButton')?.addEventListener('click',()=>form({title:'Add Content Block',fields:[{name:'type',label:'Block type',type:'select',value:'text',options:[{value:'text',label:'Text'},{value:'media',label:'Media'},{value:'link',label:'External Link'}]}],confirmText:'Add Block',onSubmit:({type})=>addBlock(type)}));
    $('addBlockFooterButton')?.addEventListener('click',()=>addBlock('text'));
    list.addEventListener('click', async e=>{
      const block=e.target.closest('.content-block'); if(!block)return;
      if(e.target.closest('.delete-block')){block.remove();renumberBlocks();}
      if(e.target.closest('.move-up')){const prev=block.previousElementSibling;if(prev)list.insertBefore(block,prev);renumberBlocks();}
      if(e.target.closest('.move-down')){const next=block.nextElementSibling;if(next)list.insertBefore(next,block);renumberBlocks();}
      const picker=e.target.closest('.select-media'); if(picker){ await openMediaPicker(picker.closest('.media-dropzone')); }
    });

    async function save(statusOverride=null) {
      const title=$('lessonTitle').value.trim(), sectionId=$('lessonSection').value;
      if(!title||!sectionId) throw new Error('Lesson title and section are required.');
      const payload={section_id:sectionId,title,description:$('lessonDescription').value.trim()||null};
      if(statusOverride) payload.status=statusOverride;
      if(!currentId){ const {data,error}=await client.from('lms_lessons').insert(payload).select().single();if(error)throw error;currentId=data.id; history.replaceState({},'',`admin-lms-lesson-builder.html?id=${encodeURIComponent(currentId)}`); }
      else { const {error}=await client.from('lms_lessons').update(payload).eq('id',currentId);if(error)throw error; }
      const existing=(await client.from('lms_content_blocks').select('id').eq('lesson_id',currentId)).data||[];
      const existingIds=new Set(existing.map(x=>x.id)); const seen=new Set();
      const blocks=[...list.querySelectorAll('.content-block')];
      for(let i=0;i<blocks.length;i++){
        const el=blocks[i], id=el.dataset.blockId||'', type=el.dataset.blockType||'text';
        const media=el.querySelector('.media-dropzone');
        const row={lesson_id:currentId,block_type:type,title:el.querySelector('.block-title-input')?.value.trim()||null,sort_order:i+1,content:el.querySelector('.content-editor')?.value||null,media_id:media?.dataset.mediaId||null,external_url:el.querySelector('.block-external-url')?.value.trim()||null,is_required:false,settings:{}};
        if(id){const {error}=await client.from('lms_content_blocks').update(row).eq('id',id);if(error)throw error;seen.add(id);} else {const {data,error}=await client.from('lms_content_blocks').insert(row).select().single();if(error)throw error;el.dataset.blockId=data.id;seen.add(data.id);}
      }
      const remove=[...existingIds].filter(id=>!seen.has(id)); if(remove.length){const {error}=await client.from('lms_content_blocks').delete().in('id',remove);if(error)throw error;}
      message(statusOverride==='published'?'Lesson published.':'Lesson saved.','success');
    }
    $('saveLessonButton')?.addEventListener('click',()=>save().catch(e=>{console.error(e);message(e.message,'error');}));
    $('publishLessonButton')?.addEventListener('click',()=>save('published').catch(e=>{console.error(e);message(e.message,'error');}));
  }

  function ensureMediaControls(){
    const upload=$('uploadMediaButton'); if(!upload)return;
    const cloud=document.createElement('button');cloud.type='button';cloud.className='lms-btn lms-btn-secondary';cloud.id='addCloudflareVideoButton';cloud.textContent='+ Add Cloudflare Video';upload.parentNode.insertBefore(cloud,upload);
  }
  async function initMedia(){
    const session=await requireAdmin();if(!session)return; ensureMediaControls();
    const client=db(); let records=[];
    async function usageMaps(){
      const [{data:courseRows},{data:blockRows}]=await Promise.all([
        client.from('lms_courses').select('thumbnail_media_id').not('thumbnail_media_id','is',null),
        client.from('lms_content_blocks').select('media_id').not('media_id','is',null)
      ]);
      const course=new Set((courseRows||[]).map(x=>x.thumbnail_media_id)); const block=new Set((blockRows||[]).map(x=>x.media_id)); return {course,block};
    }
    async function load(){
      const {data,error}=await client.from('lms_media').select('*').order('created_at',{ascending:false});if(error)throw error;records=data||[];
      const maps=await usageMaps();
      const total=records.length, courseCount=records.filter(m=>maps.course.has(m.id)).length, blockCount=records.filter(m=>maps.block.has(m.id)).length, unused=records.filter(m=>!maps.course.has(m.id)&&!maps.block.has(m.id)).length;
      $('statTotalMedia').textContent=total;$('statCourseMedia').textContent=courseCount;$('statLessonMedia').textContent=blockCount;$('statUnusedMedia').textContent=unused;
      render(maps);
    }
    function render(maps){
      const q=($('mediaSearch')?.value||'').toLowerCase(), type=$('mediaTypeFilter')?.value||'', usage=$('mediaUsageFilter')?.value||'', sort=$('mediaSortFilter')?.value||'newest';
      let rows=records.filter(m=>{const hay=[m.title,m.original_filename,m.id,m.provider_video_id].join(' ').toLowerCase(); if(q&&!hay.includes(q))return false;if(type&&m.media_type!==type)return false;const u=maps.course.has(m.id)?'course':maps.block.has(m.id)?'content_block':'unused';return !usage||u===usage;});
      rows.sort((a,b)=>sort==='name'?String(a.title||a.original_filename).localeCompare(String(b.title||b.original_filename)):sort==='oldest'?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at));
      $('mediaTableBody').innerHTML=rows.length?rows.map(m=>{const u=maps.course.has(m.id)?'Course':maps.block.has(m.id)?'Content Block':'Unused';return `<tr><td><strong>${esc(m.title||m.original_filename)}</strong><br><small>${esc(m.provider==='cloudflare'?'Cloudflare Video ID: '+(m.provider_video_id||'—'):m.original_filename)}</small></td><td>${esc(m.media_type)}</td><td>${new Date(m.created_at).toLocaleDateString()}</td><td>${u}</td><td>${m.provider==='cloudflare'?'Cloudflare':'Storage'}</td><td><small>${esc(m.id)}</small></td><td><button class="icon-action delete-media" data-id="${m.id}">Delete</button></td></tr>`;}).join(''):'<tr><td colspan="7"><div class="empty-media">No matching media records.</div></td></tr>';
    }
    ['mediaSearch','mediaTypeFilter','mediaUsageFilter','mediaSortFilter'].forEach(id=>$(id)?.addEventListener(id==='mediaSearch'?'input':'change',async()=>render(await usageMaps())));
    $('clearMediaFilters')?.addEventListener('click',async()=>{ $('mediaSearch').value='';$('mediaTypeFilter').value='';$('mediaUsageFilter').value='';$('mediaSortFilter').value='newest';render(await usageMaps()); });
    $('uploadMediaButton')?.addEventListener('click',()=>{const input=document.createElement('input');input.type='file';input.accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,audio/*';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const {data:{user}}=await client.auth.getUser();const path=`${user?.id||'uploads'}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:upErr}=await client.storage.from('lms-media').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;const mt=file.type.startsWith('image/')?'image':file.type==='application/pdf'||file.type.includes('word')||file.type.includes('sheet')||file.type.includes('presentation')?'document':file.type.startsWith('image/')?'image':'other';const {error}=await client.from('lms_media').insert({uploaded_by:user?.id||null,media_type:mt,original_filename:file.name,storage_bucket:'lms-media',storage_path:path,mime_type:file.type||null,file_size_bytes:file.size,title:file.name,provider:'supabase_storage'});if(error)throw error;message('Media uploaded.','success');await load();}catch(e){console.error(e);message(e.message,'error');}};input.click();});
    $('addCloudflareVideoButton')?.addEventListener('click',()=>form({title:'Add Cloudflare Video',message:'Paste the Cloudflare Video ID. This does not upload the video to Supabase Storage.',fields:[{name:'title',label:'Video title',required:true},{name:'video_id',label:'Cloudflare Video ID',required:true},{name:'playback_url',label:'Playback URL',type:'url'},{name:'thumbnail_url',label:'Thumbnail URL',type:'url'}],confirmText:'Add Video',onSubmit:async v=>{const {data:{user}}=await client.auth.getUser();const {error}=await client.from('lms_media').insert({uploaded_by:user?.id||null,media_type:'video',original_filename:`cloudflare-${v.video_id}`,storage_bucket:'lms-media',storage_path:`cloudflare/${v.video_id}`,title:v.title,provider:'cloudflare',provider_video_id:v.video_id,playback_url:v.playback_url||null,thumbnail_url:v.thumbnail_url||null,provider_status:'ready'});if(error)throw error;await load();message('Cloudflare video added.','success');}}));
    $('mediaTableBody')?.addEventListener('click',e=>{const b=e.target.closest('.delete-media');if(!b)return;confirmAction({title:'Delete Media?',message:'This will permanently remove the media record and its Supabase Storage file when applicable.',type:'warning',confirmText:'Delete',onConfirm:async()=>{const m=records.find(x=>x.id===b.dataset.id);if(m?.provider==='supabase_storage'&&m.storage_path){const {error:se}=await client.storage.from(m.storage_bucket||'lms-media').remove([m.storage_path]);if(se)throw se;}const {error}=await client.from('lms_media').delete().eq('id',b.dataset.id);if(error)throw error;await load();message('Media deleted.','success');}});});
    await load();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const run=page==='admin-lms-lessons.html'?initLessons:page==='admin-lms-lesson-builder.html'?initLessonBuilder:page==='admin-lms-media.html'?initMedia:null;
    if(run)run().catch(e=>{console.error('LMS Phase 3 error:',e);message(e.message||'Unable to load LMS data.','error');});
  });
})();
