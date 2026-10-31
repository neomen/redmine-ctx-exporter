'use strict';
import { RedmineClient } from './api.js';
import { Resolver } from './resolver.js';
import { buildSingleMarkdown, buildBulkMarkdown } from './export.js';
import { slugify, sanitizeFilename, timestamp } from './util.js';
import { scanText } from './scanner.js';

const BULK_CONCURRENCY = 4;

// ---------- config ----------
async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  if (!config?.baseUrl || !config?.apiKey) {
    throw new Error('Redmine is not configured. Open the extension settings.');
  }
  return config;
}

function assertSameOrigin(configBaseUrl, pageBaseUrl) {
  const a = new URL(configBaseUrl).origin;
  const b = new URL(pageBaseUrl).origin;
  if (a !== b) {
    throw new Error(`Configured Redmine (${a}) does not match current page (${b}).`);
  }
}

// ---------- download via tab (most reliable in MV3) ----------
async function downloadInTab(tabId, content, filename) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (content, filename) => {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    args: [content, filename]
  });
}

// ---------- concurrency helper ----------
function runWithConcurrency(items, limit, worker, onProgress) {
  return new Promise((resolve, reject) => {
    let i = 0, running = 0, done = 0;
    const next = () => {
      if (done === items.length) return resolve();
      while (running < limit && i < items.length) {
        const idx = i++;
        running++;
        Promise.resolve(worker(items[idx], idx))
          .then(() => { running--; done++; onProgress?.(done, items.length); next(); })
          .catch(reject);
      }
    };
    next();
  });
}

// ---------- confirm with user (in the tab) ----------
async function confirmWithUser(findings, tabId) {
  // We group them by patternId so as not to show 20 identical rows.
  const byPattern = new Map();
  for (const f of findings) {
    const entry = byPattern.get(f.patternId) || { label: f.label, count: 0 };
    entry.count++;
    byPattern.set(f.patternId, entry);
  }

  const lines = [...byPattern.entries()]
    .map(([id, { label, count }]) => `  • ${label} (${id}) — ${count}×`)
    .join('\n');

  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: (message) => window.confirm(message),
      args: [
        `⚠️ The export contains ${findings.length} potential secret(s):\n\n` +
        `${lines}\n\n` +
        `Continue?\n\n` +
        `OK = download as-is, Cancel = abort export.`
      ]
    }, (results) => {
      resolve(results?.[0]?.result === true);
    });
  });
}

// ---------- scan helper (used by both handlers) ----------
async function applySecretScan(text, config, tabId) {
  const mode = config.exportDefaults?.secretScanMode || 'warn';
  const result = scanText(text, { mode });

  if (result.clean) return { proceed: true, output: text };

  if (result.mode === 'warn') {
    const ok = await confirmWithUser(result.findings, tabId);
    if (!ok) return { proceed: false, output: null };
  }

  return { proceed: true, output: result.output };
}

// ---------- single ----------
async function handleSingle({ issueId, baseUrl }, tabId) {
  const config = await getConfig();
  assertSameOrigin(config.baseUrl, baseUrl);

  const client = new RedmineClient(config);
  const resolver = new Resolver(client);
  await resolver.ensureDictionaries();

  const issue = await client.getIssue(issueId);
  const rawMd = buildSingleMarkdown(issue, resolver);

  const scan = await applySecretScan(rawMd, config, tabId);
  if (!scan.proceed) return { count: 0, filename: null, aborted: true };

  const filename = `issue-${issue.id}-${slugify(issue.subject)}.md`;
  await downloadInTab(tabId, scan.output, filename);
  return { count: 1, filename };
}

// ---------- list ----------
async function handleList({ projectIdentifier, filterQuery, baseUrl }, tabId) {
  const config = await getConfig();
  assertSameOrigin(config.baseUrl, baseUrl);

  const client = new RedmineClient(config);
  const resolver = new Resolver(client);
  await resolver.ensureDictionaries();

  // 1. Stubs from the filter (respecting sort from the form).
  const stubs = [];
  for await (const stub of client.iterateIssues(filterQuery, { projectIdentifier })) {
    stubs.push(stub);
  }
  if (!stubs.length) {
    throw new Error('No issues match the current filter.');
  }

  // 2. Full issue data.
  const fetched = [];
  await runWithConcurrency(
    stubs.map((s, i) => ({ ...s, _idx: i })),
    BULK_CONCURRENCY,
    async (stub) => {
      try {
        const full = await client.getIssue(stub.id);
        fetched.push({ _idx: stub._idx, issue: full });
      } catch (e) {
        console.warn(`skip #${stub.id}:`, e);
      }
    },
    (done, total) => {
      chrome.tabs
        .sendMessage(tabId, { action: 'progress', done, total })
        .catch(() => {});
    }
  );

  if (!fetched.length) {
    throw new Error('Failed to fetch any issues.');
  }

  fetched.sort((a, b) => a._idx - b._idx);
  const issues = fetched.map((x) => x.issue);

  const projectName = issues[0]?.project?.name || projectIdentifier || 'Redmine';
  const rawMd = buildBulkMarkdown(issues, resolver, {
    projectName,
    exportedAt: new Date()
  });

  const scan = await applySecretScan(rawMd, config, tabId);
  if (!scan.proceed) return { count: 0, filename: null, aborted: true };

  const filename =
    sanitizeFilename(
      `${slugify(projectIdentifier || 'all-projects')}-${timestamp()}-${issues.length}issues`
    ) + '.md';

  await downloadInTab(tabId, scan.output, filename);
  return { count: issues.length, filename };
}

// ---------- message router ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'ping') {
    chrome.storage.local.get('config').then(({ config }) => {
      sendResponse({ configured: !!(config?.baseUrl && config?.apiKey) });
    });
    return true;
  }
  if (!sender.tab?.id) return;

  const tabId = sender.tab.id;

  if (msg.action === 'export_single') {
    handleSingle(msg, tabId).then(
      (r) => sendResponse({ ok: true, ...r }),
      (e) => sendResponse({ ok: false, error: e.message })
    );
    return true;
  }
  if (msg.action === 'export_list') {
    handleList(msg, tabId).then(
      (r) => sendResponse({ ok: true, ...r }),
      (e) => sendResponse({ ok: false, error: e.message })
    );
    return true;
  }
});