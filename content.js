'use strict';

(function () {
  if (window.__REDMINE_EXPORTER__) return;
  window.__REDMINE_EXPORTER__ = true;

  const BASE_URL = location.origin;

  // ---------- page detection ----------
  function detectPage() {
    const path = location.pathname;

    const single = path.match(/^\/issues\/(\d+)(?:\/|$)/);
    if (single) return { type: 'single', id: parseInt(single[1], 10) };

    const projectList = path.match(/^\/projects\/([^/]+)\/issues\/?$/);
    if (projectList) {
      return { type: 'list', projectIdentifier: decodeURIComponent(projectList[1]) };
    }

    if (path === '/issues' || path === '/issues/') {
      return { type: 'list', projectIdentifier: null };
    }

    return { type: 'other' };
  }

  // ---------- filter extraction ----------
  // Priority 1: parse the actual <form id="query_form">. This is what the
  // server rendered for the CURRENT query, so it is the ground truth.
  // Priority 2: fall back to URL parsing for cases where the form is absent.
  function extractFilterFromForm() {
    const form = document.getElementById('query_form');
    if (!form) return null;

    const params = new URLSearchParams();
    params.set('set_filter', '1');

    // Collect active field names from f[] checkboxes and non-empty f[] hidden inputs.
    const activeFields = new Set();
    form.querySelectorAll('input[name="f[]"]').forEach((el) => {
      if (el.type === 'checkbox' && el.checked && el.value.trim()) {
        activeFields.add(el.value.trim());
      } else if (el.type === 'hidden' && el.value.trim()) {
        activeFields.add(el.value.trim());
      }
    });

    for (const field of activeFields) {
      params.append('f[]', field);

      const opEl = form.querySelector(`select[name="op[${field}]"], input[name="op[${field}]"]`);
      if (opEl && opEl.value !== '') {
        params.set(`op[${field}]`, opEl.value);
      }

      // v[] selects are disabled when empty (Redmine hides them via JS).
      form.querySelectorAll(`select[name="v[${field}][]"], input[name="v[${field}][]"]`).forEach((vEl) => {
        if (vEl.disabled) return;
        if (!vEl.value || !vEl.value.trim()) return;
        params.append(`v[${field}][]`, vEl.value.trim());
      });
    }

    // sort / group_by
    const sortEl = form.querySelector('input[name="sort"]');
    if (sortEl && sortEl.value.trim()) {
      params.set('sort', sortEl.value.trim());
    }
    const groupByEl = form.querySelector('select[name="group_by"]');
    if (groupByEl && groupByEl.value.trim()) {
      params.set('group_by', groupByEl.value.trim());
    }

    return params;
  }

  function extractFilterFromUrl() {
    const urlParams = new URL(location.href).searchParams;
    const params = new URLSearchParams();
    params.set('set_filter', '1');

    for (const [k, v] of urlParams) {
      if (k === 'f[]') {
        if (v.trim()) params.append('f[]', v.trim());
      } else if (k.startsWith('op[') || k.startsWith('v[') || k === 'sort') {
        params.append(k, v);
      }
    }

    return params;
  }

  function extractFilter() {
    return extractFilterFromForm() || extractFilterFromUrl();
  }

  // ---------- UI ----------
  function injectStyles() {
    if (document.getElementById('rx-style')) return;
    const s = document.createElement('style');
    s.id = 'rx-style';
    s.textContent = `
      .rx-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:4px;
        cursor:pointer;background:#2196f3;color:#fff;border:none;font:600 12px/1.2 system-ui,sans-serif;
        transition:background .15s;margin:0 8px 0 0;vertical-align:middle}
      .rx-btn:hover{background:#1976d2}
      .rx-btn:disabled{background:#90caf9;cursor:wait}
      .rx-toast{position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#323232;color:#fff;
        padding:12px 18px;border-radius:8px;font:13px/1.4 system-ui,sans-serif;
        box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:400px;transition:opacity .3s,transform .3s}
      .rx-toast.error{background:#d32f2f}
      .rx-toast.success{background:#2e7d32}
    `;
    document.head.appendChild(s);
  }

  function toast(text, type = 'info') {
    const d = document.createElement('div');
    d.className = 'rx-toast ' + type;
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => {
      d.style.opacity = '0';
      d.style.transform = 'translateY(8px)';
      setTimeout(() => d.remove(), 300);
    }, 3500);
  }

  async function pingBackground() {
    try { return await chrome.runtime.sendMessage({ action: 'ping' }); }
    catch { return { configured: false }; }
  }

  function makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rx-btn';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      const orig = btn.textContent;
      btn.disabled = true;
      try { await onClick(btn); }
      catch (e) { toast('Export failed: ' + (e?.message || e), 'error'); }
      finally { btn.disabled = false; btn.textContent = orig; }
    });
    return btn;
  }

  // ---------- placement ----------
  async function placeSingleIssueButton(page) {
    const target = document.querySelector('#content .contextual');
    if (!target || target.querySelector('.rx-btn')) return;

    const btn = makeButton('⬇ Export this issue', async () => {
      btn.textContent = 'Exporting…';
      const r = await chrome.runtime.sendMessage({
        action: 'export_single',
        issueId: page.id,
        baseUrl: BASE_URL
      });
      if (!r?.ok) throw new Error(r?.error || 'unknown');
      toast(`Exported #${page.id} → ${r.filename}`, 'success');
    });
    target.prepend(btn);
  }

  async function placeListButton(page) {
    const target = document.querySelector('#content .contextual');
    if (!target || target.querySelector('.rx-btn')) return;

    const btn = makeButton('⬇ Export filtered issues', async () => {
      btn.textContent = 'Fetching…';

      const filterParams = extractFilter();
      const filterQuery = filterParams.toString();

      const r = await chrome.runtime.sendMessage({
        action: 'export_list',
        projectIdentifier: page.projectIdentifier,
        filterQuery,
        baseUrl: BASE_URL
      });
      if (!r?.ok) throw new Error(r?.error || 'unknown');
      toast(`Exported ${r.count} issues → ${r.filename}`, 'success');
    });
    target.prepend(btn);
  }

  async function tryPlace() {
    const page = detectPage();
    if (page.type === 'other') return;

    const ping = await pingBackground();

    if (!ping?.configured) {
      const target = document.querySelector('#content .contextual');
      if (target && !target.querySelector('.rx-btn')) {
        const btn = makeButton('⚙ Configure Redmine Exporter', () => chrome.runtime.openOptionsPage());
        target.prepend(btn);
      }
      return;
    }

    if (page.type === 'single') await placeSingleIssueButton(page);
    else if (page.type === 'list') await placeListButton(page);
  }

  // ---------- progress updates from background ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === 'progress') {
      const btn = document.querySelector('.rx-btn:disabled');
      if (btn) btn.textContent = `Fetching… ${msg.done}/${msg.total}`;
    }
  });

  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryPlace, 250));
  } else {
    setTimeout(tryPlace, 250);
  }
})();