/* Direct SMTP inquiry when configured; truthful email-client fallback otherwise. */
(() => {
 const form=document.getElementById('contactForm'); if(!form)return;
 const status=document.getElementById('formStatus'),submit=document.getElementById('contactSubmit');
 const email='sarasavioffsetprinters@gmail.com';
 function report(message,kind=''){status.textContent=message;status.className='form-status '+kind;}
 form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!form.reportValidity())return;
   const fields=Object.fromEntries(new FormData(form).entries());
   const body=Object.entries(fields).map(([key,value])=>`${key}: ${value}`).join('\n');
   const subject=`Sarasavi website inquiry — ${fields.service||'Printing'}`;
   submit.disabled=true; report('Checking whether direct sending is available…');
   try{
     const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6000);
     let response;
     try{response=await fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'Contact inquiry',fields}),signal:controller.signal});}
     finally{clearTimeout(timeout)}
     if(response.ok){const result=await response.json();if(result.sent===true){report('Your inquiry was sent. Thank you for contacting us.','success');form.reset();return;}}
   }catch(_error){}
   const mailto=`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
   report('Your email app will open with your message. Please press Send there. If it does not open, use the email address in the contact details.');
   window.location.href=mailto;
 });
 form.addEventListener('input',()=>{if(status.classList.contains('error'))report('')});
 form.addEventListener('submit',()=>{setTimeout(()=>{submit.disabled=false},1000)});
})();