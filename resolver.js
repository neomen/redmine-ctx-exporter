export class Resolver {
  constructor(client) {
    this.client = client;
    this.statuses = null;
    this.trackers = null;
    this.priorities = null;
    this.users = new Map();
  }

  async ensureDictionaries() {
    if (this.statuses) return;
    const [s, t, p] = await Promise.all([
      this.client.request('/issue_statuses.json'),
      this.client.request('/trackers.json'),
      this.client.request('/enumerations/issue_priorities.json')
    ]);
    const idx = (arr) => Object.fromEntries(arr.map(x => [String(x.id), x.name]));
    this.statuses   = idx(s.issue_statuses);
    this.trackers   = idx(t.trackers);
    this.priorities = idx(p.issue_priorities);
  }

  rememberUser(u) {
    if (u?.id && u.name) this.users.set(String(u.id), u.name);
  }

  resolveAttr(name, value) {
    if (value == null || value === '') return '—';
    switch (name) {
      case 'status_id':    return this.statuses[value]   || `#${value}`;
      case 'tracker_id':   return this.trackers[value]   || `#${value}`;
      case 'priority_id':  return this.priorities[value] || `#${value}`;
      case 'assigned_to_id':
      case 'author_id':    return this.users.get(String(value)) || `user#${value}`;
      case 'parent_id':    return `#${value}`;
      case 'fixed_version_id':
      case 'category_id':  return `#${value}`;
      default:             return String(value);
    }
  }
}