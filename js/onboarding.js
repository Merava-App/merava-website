import { supabase } from './supabase-client.js';
import { requireBusinessUser, getMyStudio, signOutAndRedirect } from './business-guard.js';
import { setStatus } from './dashboard-shared.js';

const dashUserEmail = document.querySelector('#dashUserEmail');
const signOutBtn = document.querySelector('#signOutBtn');

const introSection = document.querySelector('#introSection');
const optionGrid = document.querySelector('#optionGrid');
const manualEntryBtn = document.querySelector('#manualEntryBtn');
const studioSection = document.querySelector('#studioSection');

const studioForm = document.querySelector('#studioForm');
const studioStatus = document.querySelector('#studioStatus');
const studioSubmitBtn = document.querySelector('#studioSubmitBtn');

let currentUser = null;

init();

async function init() {
  const user = await requireBusinessUser();
  if (!user) return;

  currentUser = user;
  dashUserEmail.textContent = user.email;

  // Already set up — this is a one-time step, so send returning users
  // straight to the real dashboard instead of showing it again.
  const studio = await getMyStudio(user.id);
  if (studio) {
    window.location.href = 'dashboard.html';
  }
}

signOutBtn.addEventListener('click', signOutAndRedirect);

manualEntryBtn.addEventListener('click', () => {
  introSection.hidden = true;
  optionGrid.hidden = true;
  studioSection.hidden = false;
  studioSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

studioForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(studioStatus, '', null);
  studioSubmitBtn.disabled = true;

  const payload = {
    owner_id: currentUser.id,
    name: studioForm.name.value.trim(),
    image: studioForm.image.value.trim() || null,
    address: studioForm.address.value.trim(),
    city: studioForm.city.value.trim() || null,
    province: studioForm.province.value.trim() || null,
    postal_code: studioForm.postal_code.value.trim() || null,
    country: studioForm.country.value.trim() || null,
    description: studioForm.description.value.trim() || null,
  };

  const { error } = await supabase.from('Studios').insert(payload);

  if (error) {
    studioSubmitBtn.disabled = false;
    setStatus(studioStatus, error.message, 'error');
    return;
  }

  setStatus(studioStatus, 'Saved — taking you to your dashboard…', 'success');
  window.location.href = 'dashboard.html';
});
