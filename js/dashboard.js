import { supabase } from './supabase-client.js';

let currentUser = null;
let currentStudio = null;
let allTags = [];

// UI state that needs to survive a re-render (loadClasses() rebuilds the
// whole list from scratch after every mutation, so which cards are open and
// which row is being edited lives here rather than in the DOM).
const expandedClassIds = new Set();
const expandedSessionIds = new Set();
let editingClassId = null;
let editingSessionId = null;

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
  tagCheckboxes.innerHTML = tagCheckboxesHtml('tags', []);
}

function tagCheckboxesHtml(groupName, selectedIds) {
  const selected = new Set(selectedIds.map(String));
  return allTags
    .map(
      (tag) => `
        <label class="tag-checkbox">
          <input type="checkbox" name="${groupName}" value="${tag.id}" ${selected.has(String(tag.id)) ? 'checked' : ''}>
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

async function getClassTagIds(classId) {
  const { data, error } = await supabase
    .from('Class_tags')
    .select('tag_id')
    .eq('class_info_id', classId);

  if (error) {
    console.error('getClassTagIds error:', error.message);
    return [];
  }

  return (data || []).map((row) => row.tag_id);
}

function classCardHtml(classItem) {
  const isExpanded = expandedClassIds.has(classItem.id);
  const isEditing = editingClassId === classItem.id;

  const sessions = [...(classItem.Class_sessions || [])].sort(
    (a, b) => new Date(a.class_time) - new Date(b.class_time)
  );

  return `
    <div class="class-card" data-class-id="${classItem.id}">
      <button type="button" class="class-card-head" data-class-toggle="${classItem.id}">
        <span class="class-card-head-main">
          <h3>${escapeHtml(classItem.title)}</h3>
          <span class="class-card-meta">
            ${classItem.default_duration ?? '—'} min · $${classItem.studio_class_price ?? '—'} · cap ${classItem.default_capacity ?? '—'}
            · ${sessions.length} session${sessions.length === 1 ? '' : 's'}
          </span>
        </span>
        <span class="card-chevron ${isExpanded ? 'card-chevron-open' : ''}">›</span>
      </button>

      ${isExpanded ? classCardBodyHtml(classItem, sessions, isEditing) : ''}
    </div>
  `;
}

function classCardBodyHtml(classItem, sessions, isEditing) {
  if (isEditing) {
    return classEditFormHtml(classItem);
  }

  const sessionItems = sessions.length
    ? sessions.map((s) => sessionItemHtml(classItem, s)).join('')
    : '<p class="dash-empty dash-empty-sm">No sessions scheduled yet.</p>';

  return `
    <div class="class-card-body">
      <div class="class-card-details">
        <p class="class-card-description">${escapeHtml(classItem.description || 'No description yet.')}</p>
        <button type="button" class="btn btn-outline btn-sm class-edit-btn" data-class-id="${classItem.id}">
          Edit Class
        </button>
      </div>

      <div class="session-list">${sessionItems}</div>

      ${addSessionFormHtml(classItem)}
    </div>
  `;
}

function classEditFormHtml(classItem) {
  return `
    <div class="class-card-body">
      <form class="class-edit-form dash-form" data-class-id="${classItem.id}">
        <div class="form-grid">
          <label class="form-field">
            <span>Class title</span>
            <input type="text" name="title" required value="${escapeAttr(classItem.title)}">
          </label>
          <label class="form-field">
            <span>Image URL</span>
            <input type="url" name="image" required value="${escapeAttr(classItem.image)}">
          </label>
        </div>

        <label class="form-field">
          <span>Description</span>
          <textarea name="description" rows="3" required>${escapeHtml(classItem.description || '')}</textarea>
        </label>

        <div class="form-grid form-grid-4">
          <label class="form-field">
            <span>Default duration (min)</span>
            <input type="number" name="default_duration" min="0" required value="${escapeAttr(classItem.default_duration)}">
          </label>
          <label class="form-field">
            <span>Default capacity</span>
            <input type="number" name="default_capacity" min="0" required value="${escapeAttr(classItem.default_capacity)}">
          </label>
          <label class="form-field">
            <span>Default instructor</span>
            <input type="text" name="default_instructor" required value="${escapeAttr(classItem.default_instructor)}">
          </label>
          <label class="form-field">
            <span>Class price ($)</span>
            <input type="number" name="studio_class_price" min="0" step="0.01" required value="${escapeAttr(classItem.studio_class_price)}">
          </label>
        </div>
        <p class="field-note">Credits shown to customers are calculated automatically from this price.</p>

        <fieldset class="form-field">
          <legend>Tags <span class="required-note">(pick at least one)</span></legend>
          <div class="tag-checkboxes class-edit-tags" data-loading="true">Loading tags…</div>
        </fieldset>

        <p class="form-alert" data-class-edit-status></p>

        <div class="edit-actions">
          <button type="submit" class="btn btn-primary">Save Class</button>
          <button type="button" class="btn btn-ghost class-edit-cancel" data-class-id="${classItem.id}">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function sessionItemHtml(classItem, session) {
  const isExpanded = expandedSessionIds.has(session.id);
  const isEditing = editingSessionId === session.id;

  const date = new Date(session.class_time);
  const label = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const duration = session.duration_minutes ?? classItem.default_duration;
  const capacity = session.capacity ?? classItem.default_capacity;
  const instructor = session.instructor ?? classItem.default_instructor;

  const summary = `
    <button type="button" class="session-row" data-session-toggle="${session.id}">
      <span class="session-row-main">
        <span class="session-row-date">${label}</span>
        <span class="session-row-meta">${duration ?? '—'} min · cap ${capacity ?? '—'}${instructor ? ' · ' + escapeHtml(instructor) : ''}</span>
      </span>
      <span class="card-chevron ${isExpanded ? 'card-chevron-open' : ''}">›</span>
    </button>
  `;

  if (isEditing) {
    return `<div class="session-item">${summary}${sessionEditFormHtml(classItem, session)}</div>`;
  }

  if (!isExpanded) {
    return `<div class="session-item">${summary}</div>`;
  }

  return `
    <div class="session-item">
      ${summary}
      <div class="session-detail">
        <dl class="session-detail-grid">
          <div><dt>Date &amp; time</dt><dd>${date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
          <div><dt>Duration</dt><dd>${duration ?? '—'} min${session.duration_minutes == null ? ' (default)' : ''}</dd></div>
          <div><dt>Capacity</dt><dd>${capacity ?? '—'}${session.capacity == null ? ' (default)' : ''}</dd></div>
          <div><dt>Instructor</dt><dd>${instructor ? escapeHtml(instructor) : '—'}${session.instructor == null ? ' (default)' : ''}</dd></div>
        </dl>
        <div class="edit-actions">
          <button type="button" class="btn btn-outline btn-sm session-edit-btn" data-session-id="${session.id}">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm session-delete" data-session-id="${session.id}">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function sessionEditFormHtml(classItem, session) {
  const date = new Date(session.class_time);
  const dateStr = toDateInputValue(date);
  const timeStr = toTimeInputValue(date);

  return `
    <form class="session-edit-form dash-form" data-session-id="${session.id}">
      <div class="form-grid form-grid-4">
        <label class="form-field"><span>Date</span><input type="date" name="date" required value="${dateStr}"></label>
        <label class="form-field"><span>Time</span><input type="time" name="time" required value="${timeStr}"></label>
        <label class="form-field"><span>Duration (min)</span><input type="number" name="duration_minutes" min="0" placeholder="${classItem.default_duration ?? ''}" value="${escapeAttr(session.duration_minutes)}"></label>
        <label class="form-field"><span>Capacity</span><input type="number" name="capacity" min="0" placeholder="${classItem.default_capacity ?? ''}" value="${escapeAttr(session.capacity)}"></label>
      </div>
      <label class="form-field"><span>Instructor</span><input type="text" name="instructor" placeholder="${classItem.default_instructor ?? ''}" value="${escapeAttr(session.instructor)}"></label>
      <p class="form-alert" data-session-edit-status></p>
      <div class="edit-actions">
        <button type="submit" class="btn btn-primary btn-sm">Save Session</button>
        <button type="button" class="btn btn-ghost btn-sm session-edit-cancel" data-session-id="${session.id}">Cancel</button>
      </div>
    </form>
  `;
}

function addSessionFormHtml(classItem) {
  return `
    <form class="session-form" data-class-id="${classItem.id}">
      <p class="session-form-title">Add a session</p>
      <div class="form-grid form-grid-4">
        <label class="form-field"><span>Date</span><input type="date" name="date" required></label>
        <label class="form-field"><span>Time</span><input type="time" name="time" required></label>
        <label class="form-field"><span>Duration (min)</span><input type="number" name="duration_minutes" min="0" placeholder="${classItem.default_duration ?? ''}"></label>
        <label class="form-field"><span>Capacity</span><input type="number" name="capacity" min="0" placeholder="${classItem.default_capacity ?? ''}"></label>
      </div>
      <label class="form-field"><span>Instructor</span><input type="text" name="instructor" placeholder="${classItem.default_instructor ?? ''}"></label>

      <label class="repeat-row">
        <input type="checkbox" name="repeat" class="repeat-checkbox">
        <span>Repeat weekly, same day &amp; time</span>
      </label>
      <label class="form-field repeat-until" hidden>
        <span>Repeat until</span>
        <input type="date" name="repeat_until">
      </label>

      <div class="edit-actions">
        <button type="submit" class="btn btn-outline session-submit">Add Session</button>
      </div>
      <p class="form-alert" data-session-status></p>
    </form>
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

// Everything below is rendered dynamically per class/session, so it's all
// handled with delegated listeners on the shared classList container.

classList.addEventListener('click', async (e) => {
  const classToggle = e.target.closest('[data-class-toggle]');
  if (classToggle) {
    const classId = Number(classToggle.dataset.classToggle);
    if (expandedClassIds.has(classId)) {
      expandedClassIds.delete(classId);
      if (editingClassId === classId) editingClassId = null;
    } else {
      expandedClassIds.add(classId);
    }
    await loadClasses();
    return;
  }

  const sessionToggle = e.target.closest('[data-session-toggle]');
  if (sessionToggle) {
    const sessionId = Number(sessionToggle.dataset.sessionToggle);
    if (expandedSessionIds.has(sessionId)) {
      expandedSessionIds.delete(sessionId);
    } else {
      expandedSessionIds.add(sessionId);
    }
    await loadClasses();
    return;
  }

  const classEditBtn = e.target.closest('.class-edit-btn');
  if (classEditBtn) {
    editingClassId = Number(classEditBtn.dataset.classId);
    await loadClasses();
    await hydrateClassEditTags(editingClassId);
    return;
  }

  const classEditCancel = e.target.closest('.class-edit-cancel');
  if (classEditCancel) {
    editingClassId = null;
    await loadClasses();
    return;
  }

  const sessionEditBtn = e.target.closest('.session-edit-btn');
  if (sessionEditBtn) {
    editingSessionId = Number(sessionEditBtn.dataset.sessionId);
    await loadClasses();
    return;
  }

  const sessionEditCancel = e.target.closest('.session-edit-cancel');
  if (sessionEditCancel) {
    editingSessionId = null;
    await loadClasses();
    return;
  }

  const deleteBtn = e.target.closest('.session-delete');
  if (deleteBtn) {
    if (!confirm('Delete this session?')) return;

    const sessionId = Number(deleteBtn.dataset.sessionId);
    const { error } = await supabase.from('Class_sessions').delete().eq('id', sessionId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadClasses();
  }
});

async function hydrateClassEditTags(classId) {
  const container = classList.querySelector('.class-edit-tags');
  if (!container) return;

  const tagIds = await getClassTagIds(classId);
  container.dataset.loading = 'false';
  container.innerHTML = tagCheckboxesHtml('edit_tags', tagIds);
}

classList.addEventListener('change', (e) => {
  if (!e.target.classList.contains('repeat-checkbox')) return;

  const form = e.target.closest('.session-form');
  const untilField = form.querySelector('.repeat-until');
  untilField.hidden = !e.target.checked;
  untilField.querySelector('input').required = e.target.checked;
});

classList.addEventListener('submit', async (e) => {
  const classEditForm = e.target.closest('.class-edit-form');
  if (classEditForm) {
    e.preventDefault();
    await handleClassEditSubmit(classEditForm);
    return;
  }

  const sessionEditForm = e.target.closest('.session-edit-form');
  if (sessionEditForm) {
    e.preventDefault();
    await handleSessionEditSubmit(sessionEditForm);
    return;
  }

  const sessionForm = e.target.closest('.session-form');
  if (sessionForm) {
    e.preventDefault();
    await handleAddSessionSubmit(sessionForm);
  }
});

async function handleClassEditSubmit(form) {
  const classId = Number(form.dataset.classId);
  const statusEl = form.querySelector('[data-class-edit-status]');
  setStatus(statusEl, '', null);

  const selectedTagIds = Array.from(
    form.querySelectorAll('input[name="edit_tags"]:checked')
  ).map((el) => Number(el.value));

  if (selectedTagIds.length === 0) {
    setStatus(statusEl, 'Pick at least one tag.', 'error');
    return;
  }

  const payload = {
    title: form.title.value.trim(),
    image: form.image.value.trim(),
    description: form.description.value.trim(),
    default_duration: numberOrNull(form.default_duration.value),
    default_capacity: numberOrNull(form.default_capacity.value),
    default_instructor: form.default_instructor.value.trim(),
    studio_class_price: numberOrNull(form.studio_class_price.value),
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const { error } = await supabase.from('Class_info').update(payload).eq('id', classId);

  if (error) {
    submitBtn.disabled = false;
    setStatus(statusEl, error.message, 'error');
    return;
  }

  // Simplest correct way to reconcile tags: replace the whole set rather
  // than diffing which were added/removed. Requires a Class_tags DELETE
  // policy (added in 20260821090000_class_sessions_update_policy.sql) — on
  // an older database, RLS silently blocks the delete (no error, zero rows)
  // rather than failing loudly, so this checks the returned rows explicitly.
  const { data: deletedTags, error: deleteTagsError } = await supabase
    .from('Class_tags')
    .delete()
    .eq('class_info_id', classId)
    .select();

  if (deleteTagsError) {
    submitBtn.disabled = false;
    setStatus(statusEl, `Couldn't update tags: ${deleteTagsError.message}`, 'error');
    return;
  }

  const { error: insertTagsError } = await supabase
    .from('Class_tags')
    .insert(selectedTagIds.map((tag_id) => ({ class_info_id: classId, tag_id })));

  submitBtn.disabled = false;

  if (insertTagsError) {
    setStatus(statusEl, `Couldn't update tags: ${insertTagsError.message}`, 'error');
    return;
  }

  if ((deletedTags || []).length === 0 && selectedTagIds.length > 0) {
    // The delete silently affected nothing — most likely the missing RLS
    // policy from the migration above hasn't been run yet. The class itself
    // did save; only the tag reconciliation is suspect.
    setStatus(
      statusEl,
      'Class saved, but tags may be out of date — ask your admin to run the latest Supabase migration.',
      'error'
    );
  }

  editingClassId = null;
  await loadClasses();
}

async function handleSessionEditSubmit(form) {
  const sessionId = Number(form.dataset.sessionId);
  const statusEl = form.querySelector('[data-session-edit-status]');
  setStatus(statusEl, '', null);

  const date = form.date.value;
  const time = form.time.value;
  if (!date || !time) return;

  const payload = {
    class_time: new Date(`${date}T${time}`).toISOString(),
    duration_minutes: numberOrNull(form.duration_minutes.value),
    capacity: numberOrNull(form.capacity.value),
    instructor: form.instructor.value.trim() || null,
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  // Requires the Class_sessions UPDATE policy from
  // 20260821090000_class_sessions_update_policy.sql — without it, RLS
  // silently blocks the update (no error, zero rows) rather than failing
  // loudly, so this checks the returned rows explicitly.
  const { data, error } = await supabase
    .from('Class_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select();

  submitBtn.disabled = false;

  if (error) {
    setStatus(statusEl, error.message, 'error');
    return;
  }

  if ((data || []).length === 0) {
    setStatus(
      statusEl,
      "Nothing saved — ask your admin to run the latest Supabase migration.",
      'error'
    );
    return;
  }

  editingSessionId = null;
  await loadClasses();
}

async function handleAddSessionSubmit(form) {
  const classId = Number(form.dataset.classId);
  const statusEl = form.querySelector('[data-session-status]');
  setStatus(statusEl, '', null);

  const date = form.date.value;
  const time = form.time.value;
  if (!date || !time) return;

  const repeatWeekly = form.repeat.checked;
  const repeatUntil = form.repeat_until.value;

  if (repeatWeekly && !repeatUntil) {
    setStatus(statusEl, 'Pick an end date for the repeat.', 'error');
    return;
  }

  const occurrences = repeatWeekly
    ? weeklyOccurrences(date, time, repeatUntil)
    : [new Date(`${date}T${time}`)];

  if (repeatWeekly && occurrences.length === 0) {
    setStatus(statusEl, '"Repeat until" needs to be on or after the start date.', 'error');
    return;
  }

  const basePayload = {
    class_info_id: classId,
    duration_minutes: numberOrNull(form.duration_minutes.value),
    capacity: numberOrNull(form.capacity.value),
    instructor: form.instructor.value.trim() || null,
  };

  const rows = occurrences.map((occurrence) => ({
    ...basePayload,
    class_time: occurrence.toISOString(),
  }));

  const submitBtn = form.querySelector('.session-submit');
  submitBtn.disabled = true;

  const { error } = await supabase.from('Class_sessions').insert(rows);

  submitBtn.disabled = false;

  if (error) {
    setStatus(statusEl, error.message, 'error');
    return;
  }

  await loadClasses();
}

// Weekly occurrences from the given date/time through (and including)
// untilDateStr, stepping in fixed 7-day increments.
function weeklyOccurrences(dateStr, timeStr, untilDateStr) {
  const start = new Date(`${dateStr}T${timeStr}`);
  const until = new Date(`${untilDateStr}T23:59:59`);

  const dates = [];
  let cursor = start;
  while (cursor <= until) {
    dates.push(cursor);
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return dates;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

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

function escapeAttr(value) {
  return escapeHtml(value ?? '');
}
