import { supabase } from './supabase-client.js';
import {
  escapeHtml,
  numberOrNull,
  setStatus,
  tagCheckboxesHtml,
} from './dashboard-shared.js';

let currentUser = null;
let currentStudio = null;
let allTags = [];

const dashUserEmail = document.querySelector('#dashUserEmail');
const signOutBtn = document.querySelector('#signOutBtn');

const studioForm = document.querySelector('#studioForm');
const studioStatus = document.querySelector('#studioStatus');
const studioSubmitBtn = document.querySelector('#studioSubmitBtn');

const classesSection = document.querySelector('#classesSection');
const classForm = document.querySelector('#classForm');
const classStatus = document.querySelector('#classStatus');
const classSubmitBtn = document.querySelector('#classSubmitBtn');
const tagCheckboxes = document.querySelector('#tagCheckboxes');
const classList = document.querySelector('#classList');

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

  currentUser = session.user;
  dashUserEmail.textContent = currentUser.email;

  await Promise.all([loadTags(), loadStudio()]);
}

signOutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'business-login.html';
});

async function loadTags() {
  const { data, error } = await supabase.from('Tags').select('*').order('tag_name');
  if (error) {
    console.error('loadTags error:', error.message);
    return;
  }

  allTags = data || [];
  tagCheckboxes.innerHTML = tagCheckboxesHtml(allTags, 'tags', []);
}

async function loadStudio() {
  const { data, error } = await supabase
    .from('Studios')
    .select('*')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

  if (error) {
    setStatus(studioStatus, error.message, 'error');
    return;
  }

  currentStudio = data;

  if (currentStudio) {
    fillStudioForm(currentStudio);
    studioSubmitBtn.textContent = 'Update Studio';
    classesSection.hidden = false;
    await loadClasses();
  }
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

  const query = currentStudio
    ? supabase.from('Studios').update(payload).eq('id', currentStudio.id).select().single()
    : supabase.from('Studios').insert(payload).select().single();

  const { data, error } = await query;
  studioSubmitBtn.disabled = false;

  if (error) {
    setStatus(studioStatus, error.message, 'error');
    return;
  }

  currentStudio = data;
  studioSubmitBtn.textContent = 'Update Studio';
  setStatus(studioStatus, 'Saved — this is now live in the merava app.', 'success');
  classesSection.hidden = false;
  await loadClasses();
});

// Just enough per class to render a clickable summary row — the class's own
// page (class-detail.html) loads everything else itself.
async function loadClasses() {
  const { data, error } = await supabase
    .from('Class_info')
    .select('*, Class_sessions(id)')
    .eq('studio_id', currentStudio.id)
    .order('id', { ascending: false });

  if (error) {
    classList.innerHTML = `<p class="form-alert form-alert-error">${escapeHtml(error.message)}</p>`;
    return;
  }

  renderClasses(data || []);
}

function renderClasses(classes) {
  if (classes.length === 0) {
    classList.innerHTML = '<p class="dash-empty">No classes yet — add your first one above.</p>';
    return;
  }

  classList.innerHTML = classes.map(classRowHtml).join('');
}

function classRowHtml(classItem) {
  const sessionCount = (classItem.Class_sessions || []).length;

  return `
    <a class="class-row" href="class-detail.html?id=${classItem.id}">
      <span class="class-row-main">
        <span class="class-row-title">${escapeHtml(classItem.title)}</span>
        <span class="class-row-meta">
          ${classItem.default_duration ?? '—'} min · $${classItem.studio_class_price ?? '—'} · cap ${classItem.default_capacity ?? '—'}
          · ${sessionCount} session${sessionCount === 1 ? '' : 's'}
        </span>
      </span>
      <span class="card-chevron">›</span>
    </a>
  `;
}

classForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(classStatus, '', null);

  if (!currentStudio) return;

  const selectedTagIds = Array.from(
    tagCheckboxes.querySelectorAll('input[name="tags"]:checked')
  ).map((el) => Number(el.value));

  if (selectedTagIds.length === 0) {
    setStatus(classStatus, 'Pick at least one tag.', 'error');
    return;
  }

  const payload = {
    studio_id: currentStudio.id,
    title: classForm.title.value.trim(),
    image: classForm.image.value.trim(),
    description: classForm.description.value.trim(),
    default_duration: numberOrNull(classForm.default_duration.value),
    default_capacity: numberOrNull(classForm.default_capacity.value),
    default_instructor: classForm.default_instructor.value.trim(),
    studio_class_price: numberOrNull(classForm.studio_class_price.value),
  };

  classSubmitBtn.disabled = true;

  const { data, error } = await supabase.from('Class_info').insert(payload).select().single();

  if (error) {
    classSubmitBtn.disabled = false;
    setStatus(classStatus, error.message, 'error');
    return;
  }

  const { error: tagError } = await supabase
    .from('Class_tags')
    .insert(selectedTagIds.map((tag_id) => ({ class_info_id: data.id, tag_id })));

  if (tagError) console.error('Class tag insert error:', tagError.message);

  classSubmitBtn.disabled = false;
  classForm.reset();
  setStatus(classStatus, 'Class added — it now shows up in the merava app.', 'success');
  await loadClasses();
});
