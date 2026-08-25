import { supabase } from './supabase-client.js';
import { requireBusinessUserWithStudio } from './business-guard.js';
import { renderSidebar } from './sidebar.js';
import {
  escapeHtml,
  escapeAttr,
  numberOrNull,
  setStatus,
  tagCheckboxesHtml,
  toDateInputValue,
  toTimeInputValue,
  weeklyOccurrences,
} from './dashboard-shared.js';

const classId = Number(new URLSearchParams(window.location.search).get('id'));

let currentUser = null;
let classItem = null;
let sessions = [];
let allTags = [];

const expandedSessionIds = new Set();
let editingSessionId = null;

const loadingState = document.querySelector('#loadingState');
const notFoundState = document.querySelector('#notFoundState');
const classContent = document.querySelector('#classContent');

const classTitle = document.querySelector('#classTitle');
const classMeta = document.querySelector('#classMeta');
const classDescription = document.querySelector('#classDescription');
const classTagsDisplay = document.querySelector('#classTagsDisplay');

const editClassBtn = document.querySelector('#editClassBtn');
const classEditSection = document.querySelector('#classEditSection');
const classEditForm = document.querySelector('#classEditForm');
const classEditTags = document.querySelector('#classEditTags');
const classEditStatus = document.querySelector('#classEditStatus');
const cancelClassEditBtn = document.querySelector('#cancelClassEditBtn');

const sessionForm = document.querySelector('#sessionForm');
const sessionFormStatus = document.querySelector('#sessionFormStatus');
const sessionList = document.querySelector('#sessionList');

const deleteClassBtn = document.querySelector('#deleteClassBtn');

init();

async function init() {
  if (!classId) {
    showNotFound();
    return;
  }

  const ctx = await requireBusinessUserWithStudio();
  if (!ctx) return;

  currentUser = ctx.user;
  renderSidebar({ activePage: 'classes', user: currentUser });

  const { data: tagsData, error: tagsError } = await supabase
    .from('Tags')
    .select('*')
    .order('tag_name');

  if (tagsError) console.error('loadTags error:', tagsError.message);
  allTags = tagsData || [];

  await loadClass();
}

async function loadClass() {
  const { data, error } = await supabase
    .from('Class_info')
    .select('*, Class_sessions(*), Studios!inner(owner_id)')
    .eq('id', classId)
    .eq('Studios.owner_id', currentUser.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('loadClass error:', error.message);
    showNotFound();
    return;
  }

  classItem = data;
  sessions = [...(data.Class_sessions || [])].sort(
    (a, b) => new Date(a.class_time) - new Date(b.class_time)
  );

  const { data: tagRows, error: tagRowsError } = await supabase
    .from('Class_tags')
    .select('tag_id, Tags(tag_name)')
    .eq('class_info_id', classId);

  if (tagRowsError) console.error('loadClass tags error:', tagRowsError.message);
  classItem.tagIds = [...new Set((tagRows || []).map((row) => row.tag_id))];
  classItem.tagNames = [
    ...new Set(
      (tagRows || [])
        .map((row) => (Array.isArray(row.Tags) ? row.Tags[0]?.tag_name : row.Tags?.tag_name))
        .filter(Boolean)
    ),
  ];

  renderClassInfo();
  renderSessions();

  loadingState.hidden = true;
  classContent.hidden = false;
}

function showNotFound() {
  loadingState.hidden = true;
  notFoundState.hidden = false;
}

function renderClassInfo() {
  classTitle.textContent = classItem.title;
  classMeta.textContent = `${classItem.default_duration ?? '—'} min · $${classItem.studio_class_price ?? '—'} · cap ${classItem.default_capacity ?? '—'} · ${classItem.default_instructor || 'No instructor set'}`;
  classDescription.textContent = classItem.description || 'No description yet.';
  classTagsDisplay.innerHTML = classItem.tagNames
    .map((name) => `<span class="tag-chip">${escapeHtml(name)}</span>`)
    .join('');
}

editClassBtn.addEventListener('click', () => {
  fillClassEditForm();
  classEditSection.hidden = false;
  classEditSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

cancelClassEditBtn.addEventListener('click', () => {
  classEditSection.hidden = true;
});

function fillClassEditForm() {
  classEditForm.title.value = classItem.title || '';
  classEditForm.image.value = classItem.image || '';
  classEditForm.description.value = classItem.description || '';
  classEditForm.default_duration.value = classItem.default_duration ?? '';
  classEditForm.default_capacity.value = classItem.default_capacity ?? '';
  classEditForm.default_instructor.value = classItem.default_instructor || '';
  classEditForm.studio_class_price.value = classItem.studio_class_price ?? '';
  classEditTags.innerHTML = tagCheckboxesHtml(allTags, 'edit_tags', classItem.tagIds);
}

classEditForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(classEditStatus, '', null);

  const selectedTagIds = Array.from(
    classEditForm.querySelectorAll('input[name="edit_tags"]:checked')
  ).map((el) => Number(el.value));

  if (selectedTagIds.length === 0) {
    setStatus(classEditStatus, 'Pick at least one tag.', 'error');
    return;
  }

  const payload = {
    title: classEditForm.title.value.trim(),
    image: classEditForm.image.value.trim(),
    description: classEditForm.description.value.trim(),
    default_duration: numberOrNull(classEditForm.default_duration.value),
    default_capacity: numberOrNull(classEditForm.default_capacity.value),
    default_instructor: classEditForm.default_instructor.value.trim(),
    studio_class_price: numberOrNull(classEditForm.studio_class_price.value),
  };

  const submitBtn = classEditForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const { error } = await supabase.from('Class_info').update(payload).eq('id', classId);

  if (error) {
    submitBtn.disabled = false;
    setStatus(classEditStatus, error.message, 'error');
    return;
  }

  // Simplest correct way to reconcile tags: replace the whole set rather
  // than diffing which were added/removed.
  const { data: deletedTags, error: deleteTagsError } = await supabase
    .from('Class_tags')
    .delete()
    .eq('class_info_id', classId)
    .select();

  if (deleteTagsError) {
    submitBtn.disabled = false;
    setStatus(classEditStatus, `Couldn't update tags: ${deleteTagsError.message}`, 'error');
    return;
  }

  const { error: insertTagsError } = await supabase
    .from('Class_tags')
    .insert(selectedTagIds.map((tag_id) => ({ class_info_id: classId, tag_id })));

  submitBtn.disabled = false;

  if (insertTagsError) {
    setStatus(classEditStatus, `Couldn't update tags: ${insertTagsError.message}`, 'error');
    return;
  }

  if ((deletedTags || []).length === 0 && selectedTagIds.length > 0) {
    setStatus(
      classEditStatus,
      'Class saved, but tags may be out of date — ask your admin to run the latest Supabase migration.',
      'error'
    );
  }

  classEditSection.hidden = true;
  await loadClass();
});

deleteClassBtn.addEventListener('click', async () => {
  if (!confirm(`Delete "${classItem.title}"? This removes it and all its sessions.`)) return;

  deleteClassBtn.disabled = true;
  const { error } = await supabase.from('Class_info').delete().eq('id', classId);

  if (error) {
    deleteClassBtn.disabled = false;
    alert(error.message);
    return;
  }

  window.location.href = 'dashboard.html';
});

function renderSessions() {
  sessionList.innerHTML = sessions.length
    ? sessions.map(sessionItemHtml).join('')
    : '<p class="dash-empty dash-empty-sm">No sessions scheduled yet.</p>';
}

function sessionItemHtml(session) {
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
    return `<div class="session-item">${summary}${sessionEditFormHtml(session)}</div>`;
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

function sessionEditFormHtml(session) {
  const date = new Date(session.class_time);

  return `
    <form class="session-edit-form dash-form" data-session-id="${session.id}">
      <div class="form-grid form-grid-4">
        <label class="form-field"><span>Date</span><input type="date" name="date" required value="${toDateInputValue(date)}"></label>
        <label class="form-field"><span>Time</span><input type="time" name="time" required value="${toTimeInputValue(date)}"></label>
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

sessionList.addEventListener('click', async (e) => {
  const toggle = e.target.closest('[data-session-toggle]');
  if (toggle) {
    const sessionId = Number(toggle.dataset.sessionToggle);
    if (expandedSessionIds.has(sessionId)) {
      expandedSessionIds.delete(sessionId);
    } else {
      expandedSessionIds.add(sessionId);
    }
    renderSessions();
    return;
  }

  const editBtn = e.target.closest('.session-edit-btn');
  if (editBtn) {
    editingSessionId = Number(editBtn.dataset.sessionId);
    renderSessions();
    return;
  }

  const cancelBtn = e.target.closest('.session-edit-cancel');
  if (cancelBtn) {
    editingSessionId = null;
    renderSessions();
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

    await loadClass();
  }
});

sessionList.addEventListener('submit', async (e) => {
  const form = e.target.closest('.session-edit-form');
  if (!form) return;

  e.preventDefault();

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
  await loadClass();
});

sessionForm.querySelector('.repeat-checkbox').addEventListener('change', (e) => {
  const untilField = sessionForm.querySelector('.repeat-until');
  untilField.hidden = !e.target.checked;
  untilField.querySelector('input').required = e.target.checked;
});

sessionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus(sessionFormStatus, '', null);

  const date = sessionForm.date.value;
  const time = sessionForm.time.value;
  if (!date || !time) return;

  const repeatWeekly = sessionForm.repeat.checked;
  const repeatUntil = sessionForm.repeat_until.value;

  if (repeatWeekly && !repeatUntil) {
    setStatus(sessionFormStatus, 'Pick an end date for the repeat.', 'error');
    return;
  }

  const occurrences = repeatWeekly
    ? weeklyOccurrences(date, time, repeatUntil)
    : [new Date(`${date}T${time}`)];

  if (repeatWeekly && occurrences.length === 0) {
    setStatus(sessionFormStatus, '"Repeat until" needs to be on or after the start date.', 'error');
    return;
  }

  const basePayload = {
    class_info_id: classId,
    duration_minutes: numberOrNull(sessionForm.duration_minutes.value),
    capacity: numberOrNull(sessionForm.capacity.value),
    instructor: sessionForm.instructor.value.trim() || null,
  };

  const rows = occurrences.map((occurrence) => ({
    ...basePayload,
    class_time: occurrence.toISOString(),
  }));

  const submitBtn = sessionForm.querySelector('.session-submit');
  submitBtn.disabled = true;

  const { error } = await supabase.from('Class_sessions').insert(rows);

  submitBtn.disabled = false;

  if (error) {
    setStatus(sessionFormStatus, error.message, 'error');
    return;
  }

  sessionForm.reset();
  sessionForm.querySelector('.repeat-until').hidden = true;
  await loadClass();
});

