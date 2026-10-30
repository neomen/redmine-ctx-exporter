export class RedmineError extends Error {
  constructor(status, body) {
    super(`Redmine ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

export class RedmineClient {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async request(path, params) {
    const url = new URL(this.baseUrl + path);
    if (params instanceof URLSearchParams) {
      for (const [k, v] of params) url.searchParams.append(k, v);
    } else if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      headers: {
        'X-Redmine-API-Key': this.apiKey,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      let body;
      try { body = await res.json(); } catch { body = await res.text().catch(() => ''); }
      throw new RedmineError(res.status, body);
    }
    return res.json();
  }

  getIssue(id) {
    return this.request(`/issues/${id}.json`, {
      include: 'journals,relations,attachments,children'
    }).then(j => j.issue);
  }

  /**
   * Iterate issues matching a filter.
   *
   * filterQueryString — уже собранная строка вида
   *   "set_filter=1&f%5B%5D=status_id&op%5Bstatus_id%5D=o&sort=id%3Adesc"
   *   (без пустых f[]; project_id уже числовой, если он был в форме).
   *
   * projectIdentifier — slug из URL (/projects/:slug/issues). Если он задан,
   *   ходим через /projects/:slug/issues.json — тогда Redmine сам выставляет
   *   @query.project = @project, и фильтр применяется поверх проекта.
   *
   * Без identifier идём в /issues.json (глобальный список).
   */
  async *iterateIssues(filterQueryString, { projectIdentifier = null, pageSize = 100 } = {}) {
    const path = projectIdentifier
      ? `/projects/${encodeURIComponent(projectIdentifier)}/issues.json`
      : '/issues.json';

    let offset = 0;
    let total = null;

    while (true) {
      const params = new URLSearchParams(filterQueryString || '');
      params.set('set_filter', '1');
      params.set('limit', String(pageSize));
      params.set('offset', String(offset));

      const json = await this.request(path, params);
      const { issues, total_count } = json;

      if (total === null) total = total_count;

      for (const issue of issues) yield issue;

      offset += issues.length;
      if (!issues.length || offset >= total) break;
    }
  }
}