import { RedmineClient } from './api.js';

const $ = (id) => document.getElementById(id);

function show(text, ok) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'err');
}

async function load() {
  const { config } = await chrome.storage.local.get('config');
  if (config) {
    $('baseUrl').value = config.baseUrl || '';
    $('apiKey').value = config.apiKey || '';
  }
}

async function save() {
  const baseUrl = $('baseUrl').value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey').value.trim();
  if (!baseUrl || !apiKey) return show('Both fields required.', false);
  await chrome.storage.local.set({ config: { baseUrl, apiKey } });
  show('Saved.', true);
}

async function test() {
  const baseUrl = $('baseUrl').value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey').value.trim();
  if (!baseUrl || !apiKey) return show('Both fields required.', false);

  show('Testing…', true);
  try {
    const client = new RedmineClient({ baseUrl, apiKey });
    const { user } = await client.request('/users/current.json');
    const name = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.login;
    show(`Connected as ${name} (id ${user.id}).`, true);
  } catch (e) {
    show('Failed: ' + e.message, false);
  }
}

$('save').addEventListener('click', save);
$('test').addEventListener('click', test);
load();