(()=>{
'use strict';
const EMAIL='sarasavioffsetprinters@gmail.com';
const $=(s,root=document)=>root.querySelector(s);
const show=(node,html,kind='')=>{if(!node)return;node.dataset.kind=kind;node.innerHTML=html;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function request(path,data,headers={}){
 const controller=new AbortController();const id=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data),signal:controller.signal});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed');return result;
 }finally{clearTimeout(id)}
}
const query=new URLSearchParams(location.search);
const form=$('#quote-form');
if(form){
 const product=query.get('product');if(product){const select=$('[name="product"]',form);if([...select.options].some(x=>x.value===product))select.value=product;}
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const btn=$('button[type=submit]',form),out=$('#quote-result');btn.disabled=true;
  show(out,'Submitting your request…');
  const data=Object.fromEntries(new FormData(form).entries());delete data[''];
  const file=$('#quote-file')?.files?.[0];
  if(file){if(file.size>4*1024*1024){show(out,'Please choose a file smaller than 4 MB.','error');btn.disabled=false;return;}
   try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});data.attachment={name:file.name,base64};}
   catch{show(out,'Could not read your artwork file.','error');btn.disabled=false;return;}
  }
  try{const result=await request('/api/quote',data);
   show(out,`<strong>Your request was saved on this computer.</strong><br>Reference: <strong>${esc(result.reference)}</strong><br>Private PIN: <strong>${esc(result.pin)}</strong><br>Keep both for tracking. ${result.business_notified?'An email notification was sent to the business.':'Automatic email delivery is not configured. Please also contact the business to make sure they see your request.'}<br><a href="tracking.html">Track your request</a>`, 'success');form.reset();
  }catch(error){
   const fallback=Object.entries(data).filter(([key])=>key!=='attachment').map(([key,value])=>key+': '+value).join('\n');
   const mailto=`mailto:${EMAIL}?subject=${encodeURIComponent('Sarasavi printing quotation request')}&body=${encodeURIComponent(fallback)}`;
   show(out,`Could not save the request on the local server (${esc(error.message)}). <a href="${mailto}">Open a prepared email</a> and press Send in your email application. Artwork is not attached automatically.`, 'error');
  }finally{btn.disabled=false}
 });
}
const track=$('#track-form');if(track)track.addEventListener('submit',async e=>{
 e.preventDefault();const data=Object.fromEntries(new FormData(track).entries());const out=$('#track-result');show(out,'Checking status…');
 try{const result=await request('/api/track',data);show(out,`<strong>${esc(result.reference)}</strong><br>Product: ${esc(result.product)}<br>Current status: <strong>${esc(result.status)}</strong><br>Submitted: ${esc(result.created_at)}`,'success');}
 catch(error){show(out,esc(error.message),'error')}
});
const login=$('#admin-login');if(login)login.addEventListener('submit',async e=>{
 e.preventDefault();const password=$('#admin-password').value;const status=$('#admin-result'),output=$('#admin-orders');
 show(status,'Loading enquiries…');
 try{const r=await fetch('/api/admin/orders',{headers:{'X-Admin-Password':password},cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not load enquiries');
 show(status,`${j.orders.length} enquiry records loaded.`,'success');output.replaceChildren();
 if(!j.orders.length){output.textContent='No enquiries saved yet.';return;}
 const states=['Received','Reviewing','Quoted','Approved','In production','Ready','Completed','Cancelled'];
 for(const order of j.orders){const div=document.createElement('article');div.className='up-admin-item';
  div.innerHTML=`<strong>${esc(order.reference)}</strong> · ${esc(order.created_at)}<p><b>${esc(order.customer_name)}</b> — ${esc(order.email)} · ${esc(order.phone)}</p><p>${esc(order.product)} · ${esc(order.quantity)} items · ${esc(order.size)}</p><p>Material: ${esc(order.material)} · Finish: ${esc(order.finishing)}</p><p>${esc(order.notes)}</p><p>Artwork: ${esc(order.upload_name||'none')} (stored privately; no public download)</p><label>Progress <select aria-label="Status for ${esc(order.reference)}">${states.map(s=>`<option value="${esc(s)}" ${s===order.status?'selected':''}>${esc(s)}</option>`).join('')}</select></label><button type="button">Save status</button><span class="up-feedback" role="status"></span>`;
  const button=$('button',div);button.addEventListener('click',async()=>{button.disabled=true;const msg=$('span.up-feedback',div);try{await request('/api/admin/update',{reference:order.reference,status:$('select',div).value},{'X-Admin-Password':password});msg.textContent=' Saved';}catch(error){msg.textContent=' '+error.message;}finally{button.disabled=false}});
  output.append(div);
 }
 }catch(error){show(status,esc(error.message),'error');output.replaceChildren()}
});
const gallery=$('#project-gallery');if(gallery){
 gallery.querySelectorAll('[data-gallery-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.galleryFilter;
 gallery.querySelectorAll('[data-gallery-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 gallery.querySelectorAll('.sc-project-card').forEach(card=>{const container=card.closest('.col-md-6')||card;container.hidden=!(filter==='all'||card.dataset.galleryCategory===filter||(filter==='packaging'&&['retail','food'].includes(card.dataset.galleryCategory)))});
 }));
 gallery.querySelectorAll('img[data-lightbox]').forEach(img=>{
 const open=()=>{const overlay=document.createElement('div');overlay.className='up-lightbox';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Gallery image preview');const large=document.createElement('img');large.src=img.src;large.alt=img.alt;const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close preview');overlay.append(large,close);document.body.append(overlay);document.body.style.overflow='hidden';const done=()=>{overlay.remove();document.body.style.overflow='';img.focus()};close.addEventListener('click',done);overlay.addEventListener('click',e=>{if(e.target===overlay)done()});const onKey=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',onKey);done()}};document.addEventListener('keydown',onKey);close.focus()};
 img.addEventListener('click',open);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})
 });
}
// WhatsApp is intentionally opt-in: provide verified business number in site-config.js.
const wa=String(window.SARASAVI_WHATSAPP||'').replace(/\D/g,'');
if(wa.length>=10&&wa.length<=15){const a=document.createElement('a');a.href='https://wa.me/'+wa+'?text='+encodeURIComponent('Hello Sarasavi, I would like to discuss a print quotation.');a.className='sv-floating-contact';a.textContent='WhatsApp';a.target='_blank';a.rel='noopener noreferrer';document.body.append(a)}
})();
