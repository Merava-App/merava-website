import { supabase } from './supabase-client.js';

const dashUserEmail = document.querySelector('#dashUserEmail');
const signOutBtn = document.querySelector('#signOutBtn');

init();

async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'business-login.html';
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('Profiles')
    .select('is_business')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile?.is_business) {
    await supabase.auth.signOut();
    window.location.href = 'business-login.html?denied=1';
    return;
  }

  dashUserEmail.textContent = session.user.email;
}

signOutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'business-login.html';
});
