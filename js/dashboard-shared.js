// Small pure helpers shared between dashboard.html (the class list) and
// class-detail.html (one class's full editing view), so the two pages
// don't duplicate the same formatting/escaping logic.

export function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function setStatus(el, message, kind) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('form-alert-error', 'form-alert-success');
  if (kind) el.classList.add(kind === 'error' ? 'form-alert-error' : 'form-alert-success');
}

export function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function escapeAttr(value) {
  return escapeHtml(value ?? '');
}

export function tagCheckboxesHtml(allTags, groupName, selectedIds) {
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

export function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Weekly occurrences from the given date/time through (and including)
// untilDateStr, stepping in fixed 7-day increments.
export function weeklyOccurrences(dateStr, timeStr, untilDateStr) {
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
