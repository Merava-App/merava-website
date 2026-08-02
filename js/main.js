document.addEventListener('DOMContentLoaded', () => {
  console.log('Merava site loaded');

  // Sticky header shadow on scroll
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    if (window.scrollY > 12) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const headerActions = document.querySelector('.header-actions');

  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    headerActions.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.classList.toggle('is-active', isOpen);
  });

  // Close mobile nav after tapping a link
  document.querySelectorAll('.main-nav a, .header-actions a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      headerActions.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Scroll-triggered reveal animations
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // Signup forms — client-side only for now.
  // Replace this with a real request to your email/CRM provider
  // (Mailchimp, Supabase table insert, etc.) before launch.
  document.querySelectorAll('.signup-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const kind = form.dataset.form;
      const status = document.querySelector(`[data-status="${kind}"]`);
      const emailInput = form.querySelector('input[type="email"]');

      if (!emailInput.value) return;

      status.textContent = "Thanks — we'll be in touch soon!";
      form.reset();
    });
  });
});
