// Shared collapsible left sidebar for every page inside the business
// dashboard app shell (dashboard, classes, class detail, studio settings).
// Each page includes an empty <div id="sidebarRoot"></div> plus
// <div class="app-shell" id="appShell"> wrapping its <main class="app-main">,
// then calls renderSidebar({ activePage, user }) once the auth guard passes.

import { signOutAndRedirect } from './business-guard.js';

const COLLAPSE_KEY = 'merava_biz_sidebar_collapsed';

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="3" width="8" height="6" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="11" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="15" width="8" height="6" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>',
  classes: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="10.75" width="18" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="17.5" width="18" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  collapse: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 4v16" stroke="currentColor" stroke-width="1.8"/><path d="M6.3 10l-1.8 2 1.8 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  signout: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 8l4 4-4 4M8.5 12H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const NAV_ITEMS = [
  { page: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: ICONS.dashboard },
  { page: 'classes', href: 'classes.html', label: 'Classes', icon: ICONS.classes },
  { page: 'studio-settings', href: 'studio-settings.html', label: 'Studio Settings', icon: ICONS.settings },
];

export function renderSidebar({ activePage, user }) {
  const root = document.querySelector('#sidebarRoot');
  const shell = document.querySelector('#appShell');
  if (!root) return;

  root.innerHTML = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="app-sidebar-top">
        <a href="dashboard.html" class="app-sidebar-logo">
          <span class="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" stroke="currentColor" stroke-width="2"/>
              <path d="M11 20V12L16 17L21 12V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="app-sidebar-logo-text">merava <span class="dash-badge">Business</span></span>
        </a>
        <button type="button" class="app-sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar" title="Toggle sidebar">
          ${ICONS.collapse}
        </button>
      </div>

      <nav class="app-sidebar-nav">
        ${NAV_ITEMS.map(
          (item) => `
          <a href="${item.href}" class="side-nav-link ${item.page === activePage ? 'is-active' : ''}" title="${item.label}">
            <span class="side-nav-icon">${item.icon}</span>
            <span class="side-nav-label">${item.label}</span>
          </a>
        `
        ).join('')}
      </nav>

      <div class="app-sidebar-bottom">
        <span class="app-sidebar-user-email" title="${user?.email || ''}">${user?.email || ''}</span>
        <button type="button" class="side-nav-link side-nav-signout" id="sidebarSignOut" title="Sign Out">
          <span class="side-nav-icon">${ICONS.signout}</span>
          <span class="side-nav-label">Sign Out</span>
        </button>
      </div>
    </aside>
  `;

  const sidebarEl = document.querySelector('#appSidebar');
  const toggleBtn = document.querySelector('#sidebarToggle');
  const signOutBtn = document.querySelector('#sidebarSignOut');

  const collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
  setCollapsed(collapsed, sidebarEl, shell);

  toggleBtn.addEventListener('click', () => {
    const next = !sidebarEl.classList.contains('app-sidebar-collapsed');
    setCollapsed(next, sidebarEl, shell);
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  });

  signOutBtn.addEventListener('click', signOutAndRedirect);
}

function setCollapsed(collapsed, sidebarEl, shell) {
  sidebarEl.classList.toggle('app-sidebar-collapsed', collapsed);
  shell?.classList.toggle('app-shell-collapsed', collapsed);
}
