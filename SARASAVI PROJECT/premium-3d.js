/* Progressive enhancement: subtle entrance animations + correct navigation active state. */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar .nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.split('#')[0] === page) { link.classList.add('active'); link.setAttribute('aria-current', 'page'); }
      else { link.classList.remove('active'); link.removeAttribute('aria-current'); }
    });
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = [...document.querySelectorAll('#services .card, #features .feature, section .value-card, section .team-card')];
    targets.forEach(el => el.classList.add('sv-reveal'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('sv-in'); observer.unobserve(entry.target); }
    }), {threshold: 0.08});
    document.body.classList.add('sv-animate');
    targets.forEach(el => observer.observe(el));
  });
})();
