document.addEventListener('DOMContentLoaded', () => {
  const button=document.querySelector('.sv-mobile-toggle');
  const nav=document.querySelector('.sv-global-nav');
  if(button&&nav){
    button.addEventListener('click',()=>{const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));nav.classList.toggle('is-open',!expanded);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('is-open');button.setAttribute('aria-expanded','false');}});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');button.setAttribute('aria-expanded','false');}));
  }
  document.querySelectorAll('[data-current-year]').forEach(el=>el.textContent='2025');
});
