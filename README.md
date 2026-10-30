<p align="center">
  <img src="icons/128.png" alt="Redmine Context Exporter" width="96" />
</p>

<h1 align="center">Redmine Context Exporter</h1>

<p align="center">
  <strong>Export Redmine issues — with full context — to Markdown in one click.</strong><br/>
  <em>Local. Private. No servers. No telemetry. Your API key never leaves your browser.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?logo=googlechrome&logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/Redmine-4.x%20%7C%205.x-orange" alt="Redmine" />
  <img src="https://img.shields.io/badge/telemetry-none-brightgreen" alt="No telemetry" />
</p>

---

## ✨ Features

- **One-click export of a single issue** — opens any `/issues/:id` page and downloads a `.md` file with metadata, description, custom fields, attachments, relations, subtasks, and the entire journal history (with resolved names, not raw IDs).
- **One-click export of a filtered list** — on any `/projects/:slug/issues` (or global `/issues`) page, reads the filter **you already configured in Redmine's UI** and exports every matching issue into a single `.md`.
- **Filter passthrough, not filter translation** — the extension reads the `<form id="query_form">` and sends `f[]` / `op[]` / `v[]` / `sort` / `group_by` straight to `/issues.json`. Whatever the UI shows, the API returns. No reimplementation of Redmine's filter grammar.
- **Uses the REST API, not DOM scraping** — issues come from `/issues/:id.json` with `include=journals,relations,attachments,children`, so long histories and nested subtasks are complete and reliable.
- **Human-readable output** — resolved statuses, trackers, priorities, assignees, and change history with `old → new` values, so the resulting Markdown is directly usable as context for an LLM (ChatGPT, Claude, DeepSeek, …) or as an archive.
- **Progress feedback** — for large projects the inline button shows `Fetching… 12/47`.
- **SPA-friendly** — works when you navigate between issues via Redmine's own links.

---

## 🔒 Privacy — the whole point

This extension was built around two rules:

> **1. Your conversations never leave your browser.**
> **2. Your API key never leaves your browser.**

- 🟢 **All processing is local.** The extension reads your Redmine via its REST API and writes a Markdown file to disk. Nothing else.
- 🟢 **No third-party servers.** The only network requests are to the Redmine instance you configured. There are no analytics endpoints, no update pings, no crash reporting.
- 🟢 **No telemetry, no analytics.** None.
- 🟢 **No accounts, no sign-up.**
- 🟢 **No `eval`, no remote code.** Everything that runs is in this repo.
- 🟢 **Open source.** Don't trust me — read the code.

> ⚠️ **About your API key.** It is stored in `chrome.storage.local`, which is **not encrypted** — anyone with access to your OS account can read it. This is the standard storage model for browser extensions. Treat it like a password: if you export from a shared machine, remove the key afterwards from the options page.

---

## 🚀 Installation

### From source (developer mode)

```bash
git clone https://github.com/<you>/redmine-context-exporter.git
cd redmine-context-exporter
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the cloned folder

### From Chrome Web Store

_Coming soon._

---

## ⚙️ Configuration

On first use, open the extension's **Options** page and fill in two fields:

| Field | Value |
|---|---|
| **Redmine URL** | Full origin of your Redmine, e.g. `https://projects.nadostudio.com` (no trailing slash, no `/issues`). |
| **API key** | Redmine → **My account** → *API access key* → **Show**. |

Click **Test connection**. On success you should see `Connected as <Your Name> (id N)`. If it fails with `401`, double-check that:

- REST API is enabled at **Administration → Settings → API**;
- the key was copied without leading/trailing whitespace.

The extension also requires the **`host_permissions`** entry for your Redmine origin, which is requested at install time from the manifest.

---

## 🧭 Usage

### Export a single issue

1. Open any issue, e.g. `https://projects.nadostudio.com/issues/33450`.
2. Click **⬇ Export this issue** in the issue header (next to *Edit*).
3. The browser downloads `issue-33450-<slug-of-subject>.md`.

### Export a filtered list of issues

1. Open the issue list, e.g. `https://projects.nadostudio.com/projects/ooo-project-name/issues`.
2. Configure the filter in Redmine's UI as you normally would (status, assignee, tracker, …). Click **Apply**.
3. Click **⬇ Export filtered issues** in the header.
4. The browser downloads `<project>-<timestamp>-<N>issues.md`, containing:
   - a table of contents;
   - one full section per issue (same content as the single-issue export).

The **filter you configured in the UI is read directly from the form** and forwarded to the API — you don't have to re-enter anything.

---

## 🧠 How it works

### Filter passthrough (the important part)

Redmine renders the current query into a `<form id="query_form">` with hidden inputs like:

```html
<input type="hidden" name="set_filter" value="1">
<input type="checkbox" name="f[]" value="status_id" checked>
<select name="op[status_id]"><option value="o">open</option></select>
<input type="hidden" name="sort" value="id:desc">
```

The content script reads those exact inputs and reuses them verbatim as query parameters for `GET /issues.json`:

```
/issues.json?set_filter=1&f[]=status_id&op[status_id]=o&sort=id:desc&limit=100&offset=0
```

Two subtleties this handles correctly:

1. **Empty `f[]` must be dropped.** Redmine's form contains a hidden `<input name="f[]" value="">` placeholder. Forwarding it as `f[]=` makes the query return zero results — this was the #1 cause of false `No issues match the current filter.` errors during development.
2. **`project_id` must be numeric.** The JSON API rejects `v[project_id][]=ooo-project-name` (the URL slug). Instead of touching `project_id` at all, the extension uses the **project-scoped endpoint** `/projects/:slug/issues.json`, which is what the HTML page uses too. Redmine's controller then fills `@query.project` itself.

If the form is absent (rare — e.g. a legacy page), the extension falls back to parsing the URL query string.

### Issue details

The list endpoint `/issues.json` returns only **stubs** — enough to know which issues match, but *without* `journals[].details[]` (the `old → new` field deltas). Full history lives only in `/issues/:id.json`. That is why a bulk export is:

1. one paginated sweep over `/projects/:slug/issues.json` to get IDs;
2. N parallel `GET /issues/:id.json?include=journals,relations,attachments,children` (concurrency = 4);
3. merge in the original sort order;
4. single Markdown file.

### Why the journals need a resolver

`journals[].details[]` from the API look like this:

```json
{ "property": "attr", "name": "status_id", "old_value": "1", "new_value": "12" }
```

Both `old_value` and `new_value` are **raw numeric IDs**. To render `Status: New → In progress` in Markdown, the extension:

- fetches `/issue_statuses.json`, `/trackers.json`, `/enumerations/issue_priorities.json` once per session (cached in `chrome.storage.session`);
- builds an in-memory map of `user_id → name` from `issue.author`, `issue.assigned_to`, and `journal.user` as it walks the data — **never** calls `/users.json`, which requires admin privileges.

---

## 📦 Supported Redmine versions

| Version | Notes |
|---|---|
| **Redmine 4.x** (4.1.6 tested) | Full support. |
| **Redmine 5.x** | Should work — same REST API surface. |
| Redmine 3.x | Not tested; `include=children` may be missing in older builds. |
| Redmine 6.x | Not tested. |

If your instance has a non-default *Issues API* configuration, open an issue with the response body — the code paths are simple and easy to extend.

---

## 🛡️ Permissions — why each one

| Permission | Why it's needed |
|---|---|
| `storage` | Save your Redmine URL and API key locally (`chrome.storage.local`), and cache reference data (`chrome.storage.session`). |
| `activeTab` | Send the "export" message to the focused tab only. |
| `scripting` | Inject a small download helper into the page so the browser reliably saves large `.md` files. |
| `downloads` | _Not requested._ The extension avoids the broad download permission and writes the file through a `<a download>` inside the tab. |
| `host_permissions` (`https://projects.nadostudio.com/*`) | To call the Redmine REST API from the service worker. The extension **does not** request `<all_urls>`, `webRequest`, `cookies`, or any other sensitive permission. |

The content script is declared only for the configured Redmine origin in `manifest.json`; it is *not* injected on arbitrary sites.

---

## 🧩 Architecture

```
content.js                 runs on Redmine pages
 ├─ detectPage()           routes /issues/:id vs /projects/:slug/issues
 ├─ extractFilterFromForm() reads <form id="query_form">  ← the important bit
 ├─ extractFilterFromUrl()  fallback
 ├─ placeSingleIssueButton()
 └─ placeListButton()

background.js              service worker (ESM)
 ├─ handleSingle()         GET /issues/:id.json → build .md → download
 ├─ handleList()           GET /projects/:slug/issues.json (paginated)
 │                        → N× GET /issues/:id.json (concurrency 4)
 │                        → build one .md → download
 └─ runWithConcurrency()   tiny promise pool, no dependencies

api.js                     RedmineClient
 ├─ request()              fetch + X-Redmine-API-Key + JSON parse + errors
 ├─ getIssue(id)
 └─ iterateIssues()        auto-paginated async generator

resolver.js                Resolver
 ├─ ensureDictionaries()   statuses / trackers / priorities
 └─ resolveAttr()          raw id → human label (with cf_* fallback)

export.js                  MarkdownBuilder
 ├─ renderIssue()          one issue → one section
 ├─ renderDetail()         one journal detail → "Status: New → In progress"
 ├─ buildSingleMarkdown()
 └─ buildBulkMarkdown()    with table of contents

util.js                    slugify / sanitizeFilename / timestamp
```

Adding a new data source (e.g. time entries, watchers, custom enumerations) = one extra field in `renderIssue()` and one extra `include=` in `client.getIssue()`. No changes elsewhere.

---

## 🧪 Known limitations

- **Attachments are referenced, not embedded.** Markdown contains the `content_url` and human-readable size, but not the binary. This is deliberate — embedding images would make bulk exports unmanageable.
- **Description is preserved verbatim.** If your project uses Textile or Markdown in descriptions, the export keeps that source text instead of converting it to HTML/Markdown. This is the best format for LLM consumption, and the only lossless one.
- **Custom field values that are lists of enumerations** render as comma-joined values. Enumeration labels for *custom* fields are not resolved — the API sends them, but the extension uses the values as-is (usually numeric). Easy to extend if you tell us which CFs matter.
- **`/users.json` is never called** — it requires admin privileges. In journal `Changes:` lines, an assignee whose ID never appeared in `issue.author / assigned_to / journals[].user` renders as `user#<id>`.
- **Streaming / in-progress edits** — exports capture the state at the moment you click. If you started writing a comment but haven't saved it, it won't appear.

---

## 🐞 Troubleshooting

### `No issues match the current filter.`

1. Make sure the filter in the UI actually returns rows on the Redmine page itself. If it returns 0 rows, the export will too — this is expected.
2. If the page shows rows but the export doesn't:
   - open the *network* tab in DevTools on a working page and check that the request to `/issues.json` returns a non-empty `issues` array;
   - open an issue with the URL and the actual JSON response — the extension's filter passthrough is a one-to-one copy of the form.

### `Redmine 401`

- The API key is wrong, revoked, or REST is disabled.
- **Administration → Settings → API → Enable REST web service.**
- **My account → API access key → Show** — copy the fresh value into the extension's options.

### `Redmine 403` on some issues

Your user doesn't have `view_issues` on that project. The extension silently skips 403 issues in bulk exports (they're excluded from the count), and logs a warning to the service worker console (`chrome://extensions` → *Inspect views: service worker*).

### Self-signed HTTPS

Chrome will refuse the request at the network layer regardless of the extension. Install the CA in the OS trust store, or launch Chrome with the appropriate flag for your test environment.

### Non-numeric project ID in a URL

If your URL is `/projects/ooo-project-name/issues`, that's an *identifier*, not a numeric ID — and it works because the extension uses the project-scoped API endpoint. If you paste a `/issues.json` URL from a different context that embeds `v[project_id][]=ooo-project-name`, the API will reject it. Always use the project list page.

---

## 🤝 Contributing

PRs are welcome, especially:

- **Custom enumerations resolver** — for projects that use `list` type custom fields (dropdowns) whose labels need to be resolved through `/enumerations/issue_custom_field_values/:cf_id.json`.
- **Time entries** — `include=time_entries` is available in Redmine 4+; a checkbox in the options page is enough to enable it.
- **Attachments download** — an opt-in to save attachments next to the `.md` (with a subfolder and manifest entry).
- **Firefox MV3** — the code is already ESM and uses only WebExtension APIs, but a manifest tweak is needed (`background.scripts` instead of `background.service_worker`).
- **Redmine 6.x testing.**

Please keep the "no network, no telemetry" promise intact. Every new API call must go to `config.baseUrl`, nowhere else.

---

## 📄 License

MIT — do whatever you want with it, just don't add spyware to your fork.
