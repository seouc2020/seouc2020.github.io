(() => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  const year = document.querySelector('#current-year');
  if (year) year.textContent = String(new Date().getFullYear());
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();
