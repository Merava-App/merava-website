import { supabase } from './supabase-client.js';
import { requireBusinessUserWithStudio } from './business-guard.js';
import { renderSidebar } from './sidebar.js';
import { setStatus } from './dashboard-shared.js';

let currentStudio = null;

const studioForm = document.querySelector('#studioForm');
const studioStatus = document.querySelector('#studioStatus');
const studioSubmitBtn = document.querySelector('#studioSubmitBtn');

init();

async function init() {
  const ctx = await requireBusinessUserWithStudio();
  if (!ctx) return;

  renderSidebar({ activePage: 'studio-settings', user: ctx.user });
  currentStudio = ctx.studio;
  fillStudioForm(currentStudio);
}

function fillStudioForm(studio) {
  studioForm.name.value = studio.name || '';
  studioForm.image.value = studio.image || '';
  studioForm.address.value = studio.address || '';
  studioForm.city.value = studio.city || '';
  studioForm.province.value = studio.province || '';
  studioForm.postal_code.value = studio.postal_code || '';
  studioForm.country.value = studio.country || '';
  studioForm.description.value = studio.description || '';
}

studioForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(studioStatus, '', null);
  studioSubmitBtn.disabled = true;

  const payload = {
    name: studioForm.name.value.trim(),
    image: studioForm.image.value.trim() || null,
    address: studioForm.address.value.trim(),
    city: studioForm.city.value.trim() || null,
    province: studioForm.province.value.trim() || null,
    postal_code: studioForm.postal_code.value.trim() || null,
    country: studioForm.country.value.trim() || null,
    description: studioForm.description.value.trim() || null,
  };

  const { data, error } = await supabase
    .from('Studios')
    .update(payload)
    .eq('id', currentStudio.id)
    .select()
    .single();

  studioSubmitBtn.disabled = false;

  if (error) {
    setStatus(studioStatus, error.message, 'error');
    return;
  }

  currentStudio = data;
  setStatus(studioStatus, 'Saved — this is now live in the merava app.', 'success');
});
