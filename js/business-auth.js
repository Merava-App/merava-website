import { supabase } from './supabase-client.js';

const tabButtons = document.querySelectorAll('[data-tab]');
const panels = document.querySelectorAll('[data-panel]');
const signInForm = document.querySelector('#signInForm');
const signUpForm = document.querySelector('#signUpForm');
const signInStatus = document.querySelector('#signInStatus');
const signUpStatus = document.querySelector('#signUpStatus');

function showTab(name) {
  tabButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === name));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === name));
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

if (new URLSearchParams(window.location.search).get('mode') === 'signup') {
  showTab('signup');
}

function setStatus(el, message, kind) {
  el.textContent = message;
  el.classList.remove('form-alert-error', 'form-alert-success');
  if (kind) el.classList.add(kind === 'error' ? 'form-alert-error' : 'form-alert-success');
}

function setLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : form.dataset.idleLabel;
}

signInForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(signInStatus, '', null);
  setLoading(signInForm, true);

  const email = signInForm.email.value.trim();
  const password = signInForm.password.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setLoading(signInForm, false);
    setStatus(signInStatus, error.message, 'error');
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('Profiles')
    .select('is_business')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile?.is_business) {
    await supabase.auth.signOut();
    setLoading(signInForm, false);
    setStatus(
      signInStatus,
      "This account isn't registered as a business. Create a business account instead, or use the merava app to sign in as a customer.",
      'error'
    );
    return;
  }

  const { data: studio } = await supabase
    .from('Studios')
    .select('id')
    .eq('owner_id', data.user.id)
    .maybeSingle();

  window.location.href = studio ? 'dashboard.html' : 'onboarding.html';
});

function looksLikeExistingAccount(signUpData, signUpError) {
  // Business and customer accounts must now use different emails — this
  // just detects the "already registered" case so it can be reported
  // clearly, not to fold it into an upgrade anymore. Supabase signals an
  // already-registered email two different ways depending on whether email
  // confirmation is on: either an error, or (to avoid leaking which emails
  // are registered) a "successful" signup whose user has no identities.
  if (signUpError) {
    return /already registered|already exists/i.test(signUpError.message);
  }
  return signUpData?.user && signUpData.user.identities?.length === 0;
}

signUpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(signUpStatus, '', null);
  setLoading(signUpForm, true);

  const businessName = signUpForm.businessName.value.trim();
  const email = signUpForm.email.value.trim();
  const password = signUpForm.password.value;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (looksLikeExistingAccount(data, error)) {
    setLoading(signUpForm, false);
    setStatus(
      signUpStatus,
      'An account with this email already exists. Business accounts need a different email than your merava customer account — try signing in above if this is already a business account.',
      'error'
    );
    return;
  }

  if (error) {
    setLoading(signUpForm, false);
    setStatus(signUpStatus, error.message, 'error');
    return;
  }

  if (!data.session) {
    setLoading(signUpForm, false);
    setStatus(
      signUpStatus,
      'Check your email to confirm your account, then come back and sign in.',
      'success'
    );
    signUpForm.reset();
    return;
  }

  // Flip this account to a business account now that we have a session.
  // Uses upsert since the Profiles row (created by a DB trigger on signup)
  // may or may not include a username yet.
  const { error: profileError } = await supabase
    .from('Profiles')
    .upsert({ id: data.user.id, is_business: true, business_name: businessName || null });

  setLoading(signUpForm, false);

  if (profileError) {
    setStatus(
      signUpStatus,
      `Signed in, but we couldn't finish adding business access: ${profileError.message}. Contact support.`,
      'error'
    );
    return;
  }

  window.location.href = 'onboarding.html';
});
