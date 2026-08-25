import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('js-enabled');
  console.log('Merava site loaded');

  // Sticky header shadow on scroll
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 12) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const headerActions = document.querySelector('.header-actions');

  if (navToggle && mainNav && headerActions) {
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
  }

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

  // Waitlist signup forms — insert into the `Waitlist_signups` Supabase table.
  // See supabase/waitlist_signups.sql for the table + RLS policy definition.
  document.querySelectorAll('.signup-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const kind = form.dataset.form;
      const status = document.querySelector(`[data-status="${kind}"]`);
      const emailInput = form.querySelector('input[type="email"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const email = emailInput.value.trim();

      if (!email) return;

      submitBtn.disabled = true;
      status.textContent = 'Joining…';
      status.classList.remove('form-alert-error', 'form-alert-success');

      const { error } = await supabase
        .from('Waitlist_signups')
        .insert({ email, audience: kind });

      submitBtn.disabled = false;

      if (error) {
        // Unique violation means this email is already on the list — treat that as success.
        if (error.code === '23505') {
          status.textContent = "You're already on the list — we'll be in touch soon!";
          status.classList.add('form-alert-success');
          form.reset();
          return;
        }
        status.textContent = 'Something went wrong. Please try again.';
        status.classList.add('form-alert-error');
        return;
      }

      status.textContent = "Thanks — you're on the list!";
      status.classList.add('form-alert-success');
      form.reset();
    });
  });
});
