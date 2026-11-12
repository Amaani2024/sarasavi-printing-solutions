/* Sarasavi website enhancements: inquiry email fallback and optional server-powered AI chat. */
(() => {
  'use strict';
  const BUSINESS_EMAIL = 'sarasavioffsetprinters@gmail.com'; // Verify before publishing.
  const reply = (question) => {
    const q = question.toLowerCase();
    if (/price|cost|quote|quotation|rate|charge/.test(q)) return 'For a quotation, please describe the item, quantity, size, and deadline on our quotation page (quote.html). You can also email ' + BUSINESS_EMAIL + '.';
    if (/contact|email|phone|call|reach/.test(q)) return 'Email: ' + BUSINESS_EMAIL + '\nPhone: +94 773169878 (please verify). You can also use the Contact page.';
    if (/time|hour|open|close|weekend/.test(q)) return 'Please contact Sarasavi directly to confirm current opening hours.';
    if (/sample/.test(q)) return 'You can ask about samples through the quotation page. Availability needs confirmation.';
    if (/print|product|service|label|sticker|packag|poster|banner|stationery|carton|design/.test(q)) return 'We showcase cartons and packaging, labels and stickers, posters and banners, documents, business stationery, and custom design. See the Products page for details.';
    if (/hi|hello|hey|good morning/.test(q)) return 'Hello! Welcome to Sarasavi Printing Solutions. Ask about services, samples, quotations, or contact information.';
    return 'I can help with Sarasavi services, quotation requests, business hours, and contact details. For a detailed answer, please contact our team through the Contact page.';
  };
  function status(form, message) {
    let el = form.querySelector('.sarasavi-status');
    if (!el) {el = document.createElement('div');el.className='sarasavi-status';el.setAttribute('role','status');form.appendChild(el);}
    el.textContent = message;
  }
  async function submitInquiry(form, kind, fields) {
    const submit = form.querySelector('[type=submit]');
    if (submit) submit.disabled = true;
    const lines = Object.entries(fields).map(([k,v]) => `${k}: ${v}`).join('\n');
    try {
      // Only the included Python server offers this endpoint. A static host will use mailto below.
      const res = await fetch('/api/inquiry', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,fields}),signal:AbortSignal.timeout(8000)});
      const body = await res.json();
      if (res.ok && body.sent) {status(form, 'Your request was sent successfully.');form.reset();return;}
    } catch (_) { /* server absent or SMTP unconfigured */ }
    const subject = encodeURIComponent('Sarasavi - ' + kind);
    const message = encodeURIComponent(lines);
    const a = document.createElement('a');a.href=`mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${message}`;document.body.append(a);a.click();a.remove();
    status(form, 'Your email application should open with a prepared message. Please press Send in your email app to complete the request. If nothing opens, email '+BUSINESS_EMAIL+'.');
    if (submit) submit.disabled = false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const contact = document.getElementById('contactForm');
    if(contact) contact.addEventListener('submit', e => {
      e.preventDefault();
      if(!contact.reportValidity()) return;
      const fields={};
      ['name','email','phone','company','service','urgency','message','newsletter'].forEach(id=>{
        const el=document.getElementById(id);if(el)fields[id]=el.type==='checkbox'?(el.checked?'Yes':'No'):el.value;
      });
      submitInquiry(contact,'Contact inquiry',fields);
    });
    // Sample request form is uniquely identifiable in the original project.
    document.querySelectorAll('form').forEach(form=>{
      if(form===contact || !/Request Samples/i.test(form.textContent))return;
      form.addEventListener('submit',e=>{
        e.preventDefault();if(!form.reportValidity())return;
        const email=form.querySelector('input[type=email]')?.value || '';
        submitInquiry(form,'Sample request',{email,request:'Please contact me about sample availability.'});
      });
    });
    const toggle=document.createElement('button');toggle.id='sarasavi-chat-toggle';toggle.type='button';toggle.textContent='Chat with us';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','sarasavi-chat');
    const panel=document.createElement('section');panel.id='sarasavi-chat';panel.setAttribute('aria-label','Sarasavi virtual assistant');
    panel.innerHTML='<div id="sarasavi-chat-header"><strong>Sarasavi Assistant</strong><button type="button" aria-label="Close chat" id="sarasavi-chat-close">×</button></div><div id="sarasavi-chat-messages" aria-live="polite"></div><form id="sarasavi-chat-form"><input id="sarasavi-chat-input" aria-label="Your message" placeholder="Ask about printing..." maxlength="500" required autocomplete="off"><button id="sarasavi-chat-send" type="submit">Send</button></form><div id="sarasavi-chat-hint">Virtual assistant • General information only. Do not share passwords or private data.</div>';
    document.body.append(toggle,panel);
    const messages=panel.querySelector('#sarasavi-chat-messages');
    const add=(who,msg)=>{const el=document.createElement('div');el.className='sarasavi-msg '+who;el.textContent=msg;messages.append(el);messages.scrollTop=messages.scrollHeight;};
    add('bot','Hi! I can help with printing services, samples and quotations. What would you like to know?');
    toggle.addEventListener('click',()=>{const open=panel.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('#sarasavi-chat-input').focus();});
    panel.querySelector('#sarasavi-chat-close').addEventListener('click',()=>{panel.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.focus();});
    panel.querySelector('#sarasavi-chat-form').addEventListener('submit',async e=>{
      e.preventDefault();const input=panel.querySelector('#sarasavi-chat-input');const q=input.value.trim();if(!q)return;add('user',q);input.value='';const button=panel.querySelector('#sarasavi-chat-send');button.disabled=true;
      try {
        const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q}),signal:AbortSignal.timeout(15000)});
        if(!res.ok)throw Error('offline');const data=await res.json();add('bot',data.reply || reply(q));
      } catch (_) {add('bot',reply(q));}
      finally{button.disabled=false;input.focus();}
    });
  });
})();
