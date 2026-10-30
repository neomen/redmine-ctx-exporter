const { config } = await chrome.storage.local.get('config');
const s = document.getElementById('status');
if (config?.baseUrl && config?.apiKey) {
  s.textContent = 'Configured: ' + config.baseUrl;
  s.className = 'status ok';
} else {
  s.textContent = 'Not configured.';
  s.className = 'status err';
}
document.getElementById('opt').addEventListener('click', () => chrome.runtime.openOptionsPage());