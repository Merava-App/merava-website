import { supabase } from './supabase-client.js';
import { requireBusinessUserWithStudio } from './business-guard.js';
import { renderSidebar } from './sidebar.js';
import { escapeHtml } from './dashboard-shared.js';

const studioNameHeading = document.querySelector('#studioNameHeading');
const statClasses = document.querySelector('#statClasses');
const statUpcoming = document.querySelector('#statUpcoming');
const statBookings = document.querySelector('#statBookings');
const statMonthly = document.querySelector('#statMonthly');
const upcomingList = document.querySelector('#upcomingList');

init();

async function init() {
  const ctx = await requireBusinessUserWithStudio();
  if (!ctx) return;

  renderSidebar({ activePage: 'dashboard', user: ctx.user });
  studioNameHeading.textContent = ctx.studio.name;

  await loadStats(ctx.studio.id);
}

async function loadStats(studioId) {
  const { data: classes, error: classesError } = await supabase
    .from('Class_info')
    .select('id, title, default_capacity')
    .eq('studio_id', studioId);

  if (classesError) {
    console.error('loadStats classes error:', classesError.message);
    return;
  }

  const classById = new Map((classes || []).map((c) => [c.id, c]));
  const classIds = [...classById.keys()];

  if (classIds.length === 0) {
    renderStats({ totalClasses: 0, upcomingCount: 0, totalBookings: 0, monthlyBookings: 0 });
    renderUpcoming([]);
    return;
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from('Class_sessions')
    .select('id, class_info_id, class_time, capacity')
    .in('class_info_id', classIds)
    .order('class_time', { ascending: true });

  if (sessionsError) console.error('loadStats sessions error:', sessionsError.message);

  const sessions = sessionRows || [];
  const sessionIds = sessions.map((s) => s.id);

  let bookings = [];
  if (sessionIds.length > 0) {
    const { data: bookingRows, error: bookingsError } = await supabase
      .from('Bookings')
      .select('session_id, status')
      .in('session_id', sessionIds)
      .neq('status', 'cancelled');

    if (bookingsError) console.error('loadStats bookings error:', bookingsError.message);
    bookings = bookingRows || [];
  }

  const bookedCountBySession = new Map();
  bookings.forEach((b) => {
    bookedCountBySession.set(b.session_id, (bookedCountBySession.get(b.session_id) || 0) + 1);
  });

  const now = Date.now();
  const nowDate = new Date();
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
  const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1).getTime();

  const upcomingSessions = sessions.filter((s) => new Date(s.class_time).getTime() >= now);

  const sessionsInMonth = new Set(
    sessions
      .filter((s) => {
        const t = new Date(s.class_time).getTime();
        return t >= monthStart && t < monthEnd;
      })
      .map((s) => s.id)
  );
  const monthlyBookings = bookings.filter((b) => sessionsInMonth.has(b.session_id)).length;

  renderStats({
    totalClasses: classIds.length,
    upcomingCount: upcomingSessions.length,
    totalBookings: bookings.length,
    monthlyBookings,
  });

  renderUpcoming(
    upcomingSessions.slice(0, 6).map((s) => ({
      session: s,
      classInfo: classById.get(s.class_info_id),
      booked: bookedCountBySession.get(s.id) || 0,
    }))
  );
}

function renderStats(stats) {
  statClasses.textContent = stats.totalClasses;
  statUpcoming.textContent = stats.upcomingCount;
  statBookings.textContent = stats.totalBookings;
  statMonthly.textContent = stats.monthlyBookings;
}

function renderUpcoming(rows) {
  if (rows.length === 0) {
    upcomingList.innerHTML = '<p class="dash-empty">No upcoming sessions scheduled yet.</p>';
    return;
  }

  upcomingList.innerHTML = rows.map(upcomingRowHtml).join('');
}

function upcomingRowHtml({ session, classInfo, booked }) {
  const date = new Date(session.class_time);
  const label = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const capacity = session.capacity ?? classInfo?.default_capacity ?? '—';

  return `
    <a class="upcoming-row" href="class-detail.html?id=${classInfo?.id ?? ''}">
      <span class="upcoming-row-main">
        <span class="upcoming-row-title">${escapeHtml(classInfo?.title ?? 'Untitled class')}</span>
        <span class="upcoming-row-meta">${label}</span>
      </span>
      <span class="upcoming-row-booked">${booked}/${capacity} booked</span>
    </a>
  `;
}
