import { supabase } from './supabase-client.js';

let currentUser = null;
let currentStudio = null;

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

  tagCheckboxes.innerHTML = (data || [])
    .map(
      (tag) => `
        <label class="tag-checkbox">
          <input type="checkbox" name="tags" value="${tag.id}">
          <span>${escapeHtml(tag.tag_name)}</span>
        </label>
      `
    )
    .join('');
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

async function loadClasses() {
  const { data, error } = await supabase
    .from('Class_info')
    .select('*, Class_sessions(*)')
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

  classList.innerHTML = classes.map(classCardHtml).join('');
}

function classCardHtml(classItem) {
  const sessions = [...(classItem.Class_sessions || [])].sort(
    (a, b) => new Date(a.class_time) - new Date(b.class_time)
  );

  const sessionRows = sessions.length
    ? sessions.map((s) => sessionRowHtml(classItem.id, s)).join('')
    : '<p class="dash-empty dash-empty-sm">No sessions scheduled yet.</p>';

  return `
    <div class="class-card" data-class-id="${classItem.id}">
      <div class="class-card-head">
        <h3>${escapeHtml(classItem.title)}</h3>
        <span class="class-card-meta">
          ${classItem.default_duration ?? '—'} min · ${classItem.default_credit_cost ?? '—'} credits · cap ${classItem.default_capacity ?? '—'}
        </span>
      </div>

      <div class="session-list">${sessionRows}</div>

      <form class="session-form" data-class-id="${classItem.id}">
        <div class="form-grid form-grid-4">
          <label class="form-field"><span>Date</span><input type="date" name="date" required></label>
          <label class="form-field"><span>Time</span><input type="time" name="time" required></label>
          <label class="form-field"><span>Duration (min)</span><input type="number" name="duration_minutes" min="0" placeholder="${classItem.default_duration ?? ''}"></label>
          <label class="form-field"><span>Capacity</span><input type="number" name="capacity" min="0" placeholder="${classItem.default_capacity ?? ''}"></label>
        </div>
        <div class="form-grid form-grid-3">
          <label class="form-field"><span>Credits</span><input type="number" name="credits" min="0" placeholder="${classItem.default_credit_cost ?? ''}"></label>
          <label class="form-field"><span>Instructor</span><input type="text" name="instructor" placeholder="${classItem.default_instructor ?? ''}"></label>
          <button type="submit" class="btn btn-outline session-submit">Add Session</button>
        </div>
        <p class="form-alert" data-session-status></p>
      </form>
    </div>
  `;
}

function sessionRowHtml(classId, session) {
  const date = new Date(session.class_time);
  const label = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `
    <div class="session-row">
      <span>${label}</span>
      <span class="session-row-meta">${session.duration_minutes ?? '—'} min · ${session.credits ?? '—'} credits · cap ${session.capacity ?? '—'}</span>
      <button type="button" class="session-delete" data-session-id="${session.id}" aria-label="Delete session">&times;</button>
    </div>
  `;
}

classForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(classStatus, '', null);

  if (!currentStudio) return;

  const selectedTagIds = Array.from(
    tagCheckboxes.querySelectorAll('input[name="tags"]:checked')
  ).map((el) => Number(el.value));

  const payload = {
    studio_id: currentStudio.id,
    title: classForm.title.value.trim(),
    image: classForm.image.value.trim() || null,
    description: classForm.description.value.trim() || null,
    default_credit_cost: numberOrNull(classForm.default_credit_cost.value),
    default_duration: numberOrNull(classForm.default_duration.value),
    default_capacity: numberOrNull(classForm.default_capacity.value),
    default_instructor: classForm.default_instructor.value.trim() || null,
    studio_class_price: numberOrNull(classForm.studio_class_price.value),
  };

  classSubmitBtn.disabled = true;

  const { data, error } = await supabase.from('Class_info').insert(payload).select().single();

  if (error) {
    classSubmitBtn.disabled = false;
    setStatus(classStatus, error.message, 'error');
    return;
  }

  if (selectedTagIds.length) {
    const { error: tagError } = await supabase
      .from('Class_tags')
      .insert(selectedTagIds.map((tag_id) => ({ class_info_id: data.id, tag_id })));

    if (tagError) console.error('Class tag insert error:', tagError.message);
  }

  classSubmitBtn.disabled = false;
  classForm.reset();
  setStatus(classStatus, 'Class added — it now shows up in the merava app.', 'success');
  await loadClasses();
});

// Session forms and delete buttons are rendered dynamically per class, so
// they're handled with delegated listeners on the shared container.
classList.addEventListener('submit', async (e) => {
  const form = e.target.closest('.session-form');
  if (!form) return;

  e.preventDefault();

  const classId = Number(form.dataset.classId);
  const statusEl = form.querySelector('[data-session-status]');
  setStatus(statusEl, '', null);

  const date = form.date.value;
  const time = form.time.value;
  if (!date || !time) return;

  const classTime = new Date(`${date}T${time}`).toISOString();

  const payload = {
    class_info_id: classId,
    class_time: classTime,
    duration_minutes: numberOrNull(form.duration_minutes.value),
    capacity: numberOrNull(form.capacity.value),
    credits: numberOrNull(form.credits.value),
    instructor: form.instructor.value.trim() || null,
  };

  const submitBtn = form.querySelector('.session-submit');
  submitBtn.disabled = true;

  const { error } = await supabase.from('Class_sessions').insert(payload);

  submitBtn.disabled = false;

  if (error) {
    setStatus(statusEl, error.message, 'error');
    return;
  }

  await loadClasses();
});

classList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.session-delete');
  if (!btn) return;

  if (!confirm('Delete this session?')) return;

  const sessionId = Number(btn.dataset.sessionId);
  const { error } = await supabase.from('Class_sessions').delete().eq('id', sessionId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadClasses();
});

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function setStatus(el, message, kind) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('form-alert-error', 'form-alert-success');
  if (kind) el.classList.add(kind === 'error' ? 'form-alert-error' : 'form-alert-success');
}

function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
