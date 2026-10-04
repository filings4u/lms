(function(){
'use strict';
const $=id=>document.getElementById(id); let receipt=null;
const money=(n,c='usd')=>new Intl.NumberFormat('en-US',{style:'currency',currency:String(c).toUpperCase()}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function load(){
 const p=new URLSearchParams(location.search),orderId=p.get('order')||'',pi=p.get('payment_intent')||'',secret=p.get('payment_intent_client_secret')||'';
 if(!orderId||!pi||!secret){$('receiptContent').className='error';$('receiptContent').textContent='Receipt verification details are missing. Check your email for the official receipt.';return;}
 try{
  const r=await fetch(window.SCREENINGS4U_SUPABASE_URL+'/functions/v1/lms-order-receipt',{method:'POST',headers:{'Content-Type':'application/json','apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY},body:JSON.stringify({orderId,paymentIntentId:pi,paymentIntentClientSecret:secret})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to load receipt.'); receipt=d.receipt; render(); $('downloadReceipt').disabled=false;
 }catch(e){$('receiptContent').className='error';$('receiptContent').textContent=e.message||'Unable to load receipt. Check your email for the official receipt.';}
}
function render(){const r=receipt;$('orderNumber').textContent=r.orderNumber||r.orderId;const items=(r.items||[]).map(i=>`<div class="receipt-item"><div><strong>${esc(i.name)}</strong>${i.detail?`<div style="font-size:12px;color:#7b8798;margin-top:3px">${esc(i.detail)}</div>`:''}</div><strong>${money(i.lineTotal,r.currency)}</strong></div>`).join('');$('receiptContent').className='';$('receiptContent').innerHTML=`<div class="receipt-row"><span>Date</span><strong>${esc(new Date(r.paidAt||r.createdAt).toLocaleString())}</strong></div><div class="receipt-row"><span>Customer</span><strong>${esc(r.customerName||r.customerEmail)}</strong></div><div class="receipt-row"><span>Email</span><strong>${esc(r.customerEmail)}</strong></div><div class="receipt-row"><span>Payment</span><strong>${esc(r.paymentReference)}</strong></div><div class="receipt-items">${items}</div><div class="receipt-total"><span>Total paid</span><strong>${money(r.total,r.currency)}</strong></div>${r.extension?`<div class="receipt-row"><span>Course extension</span><strong>+${esc(r.extension.daysAdded)} days · access through ${esc(new Date(r.extension.newExpiresAt).toLocaleDateString())}</strong></div>`:''}`;}

// Fetch the logo as bytes instead of drawing a cross-origin image onto canvas.
// If the logo cannot be embedded for any reason, the PDF still downloads normally.
async function logoData(){
 try{
  const response=await fetch('images/logo.png',{mode:'cors',cache:'force-cache'});
  if(!response.ok)return null;
  const blob=await response.blob();
  return await new Promise(resolve=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:null);
   reader.onerror=()=>resolve(null);
   reader.readAsDataURL(blob);
  });
 }catch(_){return null;}
}

async function download(){
 if(!receipt)return;
 const button=$('downloadReceipt');
 const original=button?button.textContent:'';
 if(button){button.disabled=true;button.textContent='Preparing PDF…';}
 try{
  const jsPDF=window.jspdf&&window.jspdf.jsPDF;
  if(!jsPDF)throw new Error('PDF service is unavailable. Refresh the page and try again.');
  const doc=new jsPDF({unit:'pt',format:'letter'});const navy=[36,70,127],orange=[255,107,0],muted=[92,110,135];
  const logo=await logoData();
  if(logo){
   try{doc.addImage(logo,'PNG',48,40,170,48);}catch(_){/* Continue with text branding below. */}
  }
  if(!logo){doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('screenings4u',48,68);doc.setFontSize(9);doc.setTextColor(...orange);doc.text('LEARNING CENTER',48,84);}
  doc.setDrawColor(...orange);doc.setLineWidth(4);doc.line(48,102,564,102);doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(23);doc.text('Learning Center Receipt',48,142);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(...muted);doc.text('screenings4u | Learning Center',48,160);doc.text('Order: '+receipt.orderNumber,400,142,{align:'right'});doc.text(new Date(receipt.paidAt||receipt.createdAt).toLocaleString(),564,160,{align:'right'});let y=202;doc.setFontSize(11);doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.text('Billed to',48,y);doc.setFont('helvetica','normal');doc.setTextColor(50,65,85);doc.text(receipt.customerName||receipt.customerEmail,48,y+18);doc.text(receipt.customerEmail,48,y+35);y+=76;doc.setFillColor(...navy);doc.rect(48,y,516,28,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.text('Description',60,y+18);doc.text('Amount',550,y+18,{align:'right'});y+=42;doc.setTextColor(50,65,85);doc.setFont('helvetica','normal');for(const item of receipt.items||[]){const lines=doc.splitTextToSize(item.name,350);doc.text(lines,60,y);doc.text(money(item.lineTotal,receipt.currency),550,y,{align:'right'});y+=Math.max(24,lines.length*13+8);doc.setDrawColor(230,235,242);doc.line(60,y-8,550,y-8);}y+=14;doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(16);doc.text('Total paid',390,y);doc.text(money(receipt.total,receipt.currency),550,y,{align:'right'});y+=38;if(receipt.extension){doc.setFillColor(244,247,252);doc.roundedRect(48,y,516,54,8,8,'F');doc.setFontSize(10);doc.setTextColor(...navy);doc.text('Course extension applied automatically',60,y+19);doc.setFont('helvetica','normal');doc.setTextColor(...muted);doc.text('Added '+receipt.extension.daysAdded+' days. New access-through date: '+new Date(receipt.extension.newExpiresAt).toLocaleDateString(),60,y+37);y+=76;}doc.setDrawColor(230,235,242);doc.line(48,700,564,700);doc.setFontSize(9);doc.setTextColor(...muted);doc.text('Thank you for choosing screenings4u Learning Center.',48,722);doc.text('training.screenings4u.com',564,722,{align:'right'});doc.save('screenings4u-Learning-Center-Receipt-'+receipt.orderNumber+'.pdf');
 }catch(e){
  console.error('[LMS Success] Receipt download failed:',e);
  const msg=e&&e.message?e.message:'Unable to download the PDF receipt.';
  if(window.S4UUI&&typeof window.S4UUI.modal==='function')window.S4UUI.modal({title:'Receipt Download Unavailable',message:msg,type:'error',confirmText:'Close'});
  else alert(msg);
 }finally{
  if(button){button.disabled=false;button.textContent=original||'Download PDF Receipt';}
 }
}
document.addEventListener('DOMContentLoaded',()=>{load();const b=$('downloadReceipt');if(b)b.addEventListener('click',download);});
})();
