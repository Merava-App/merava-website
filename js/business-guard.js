// Shared auth/studio guards for every page under the business dashboard.
// Keeps the "must be signed in as a business" and "must have a studio yet"
// checks in one place instead of copy-pasted per page.

import { supabase } from './supabase-client.js';

// Verifies a signed-in business session, redirecting to sign-in otherwise.
// Returns the Supabase user, or null after already redirecting.
export async function requireBusinessUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'business-login.html';
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('Profiles')
    .select('is_business')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile?.is_business) {
    await supabase.auth.signOut();
    window.location.href = 'business-login.html?denied=1';
    return null;
  }

  return session.user;
}

export async function getMyStudio(userId) {
  const { data, error } = await supabase
    .from('Studios')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getMyStudio error:', error.message);
    return null;
  }

  return data;
}

// For pages that need both a session and an existing studio (dashboard,
// classes, class detail, studio settings) — sends first-time users to
// onboarding instead of showing an empty/broken page.
export async function requireBusinessUserWithStudio() {
  const user = await requireBusinessUser();
  if (!user) return null;

  const studio = await getMyStudio(user.id);
  if (!studio) {
    window.location.href = 'onboarding.html';
    return null;
  }

  return { user, studio };
}

export async function signOutAndRedirect() {
  await supabase.auth.signOut();
  window.location.href = 'business-login.html';
}
