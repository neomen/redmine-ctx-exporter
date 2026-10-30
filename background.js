'use strict';
import { RedmineClient } from './api.js';
import { Resolver } from './resolver.js';
import { buildSingleMarkdown, buildBulkMarkdown } from './export.js';
import { slugify, sanitizeFilename, timestamp } from './util.js';

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

// ---------- single ----------
async function handleSingle({ issueId, baseUrl }, tabId) {
  const config = await getConfig();
  assertSameOrigin(config.baseUrl, baseUrl);

  const client = new RedmineClient(config);
  const resolver = new Resolver(client);
  await resolver.ensureDictionaries();

  const issue = await client.getIssue(issueId);
  const md = buildSingleMarkdown(issue, resolver);
  const filename = `issue-${issue.id}-${slugify(issue.subject)}.md`;

  await downloadInTab(tabId, md, filename);
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

  // 2. Full issue data (journals[].details only come from /issues/:id.json).
  //    Preserve the original order from the filter's sort.
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

  const projectName =
    issues[0]?.project?.name || projectIdentifier || 'Redmine';

  const md = buildBulkMarkdown(issues, resolver, {
    projectName,
    exportedAt: new Date()
  });

  const filename =
    sanitizeFilename(
      `${slugify(projectIdentifier || 'all-projects')}-${timestamp()}-${issues.length}issues`
    ) + '.md';

  await downloadInTab(tabId, md, filename);
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