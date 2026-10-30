const ATTR_LABELS = {
  status_id: 'Status', assigned_to_id: 'Assignee', author_id: 'Author',
  priority_id: 'Priority', tracker_id: 'Tracker', subject: 'Subject',
  description: 'Description', due_date: 'Due date', start_date: 'Start date',
  done_ratio: 'Done', estimated_hours: 'Estimated', parent_id: 'Parent',
  fixed_version_id: 'Target version', category_id: 'Category'
};

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

function renderIssue(issue, resolver) {
  const cfNames = Object.fromEntries(
    (issue.custom_fields || []).map(cf => [String(cf.id), cf.name])
  );
  resolver.rememberUser(issue.author);
  resolver.rememberUser(issue.assigned_to);
  for (const j of issue.journals || []) resolver.rememberUser(j.user);

  const L = [];
  L.push(`# #${issue.id} — ${issue.subject}`);
  L.push('');
  L.push('| Field | Value |');
  L.push('|---|---|');
  L.push(`| Project | ${issue.project?.name || '—'} |`);
  L.push(`| Tracker | ${issue.tracker?.name || '—'} |`);
  L.push(`| Status | ${issue.status?.name || '—'} |`);
  L.push(`| Priority | ${issue.priority?.name || '—'} |`);
  L.push(`| Author | ${issue.author?.name || '—'} |`);
  if (issue.assigned_to) L.push(`| Assignee | ${issue.assigned_to.name} |`);
  if (issue.category) L.push(`| Category | ${issue.category.name} |`);
  if (issue.fixed_version) L.push(`| Target version | ${issue.fixed_version.name} |`);
  if (issue.parent) L.push(`| Parent | #${issue.parent.id} — ${issue.parent.subject || ''} |`);
  if (issue.start_date) L.push(`| Start | ${issue.start_date} |`);
  if (issue.due_date) L.push(`| Due | ${issue.due_date} |`);
  if (issue.done_ratio != null) L.push(`| Done | ${issue.done_ratio}% |`);
  if (issue.estimated_hours) L.push(`| Estimated | ${issue.estimated_hours}h |`);
  if (issue.spent_hours) L.push(`| Spent | ${issue.spent_hours}h |`);
  L.push(`| Created | ${issue.created_on} |`);
  L.push(`| Updated | ${issue.updated_on} |`);
  L.push('');

  if (issue.custom_fields?.length) {
    const filled = issue.custom_fields.filter(cf => {
      const v = cf.value;
      return v != null && v !== '' && !(Array.isArray(v) && !v.length);
    });
    if (filled.length) {
      L.push('## Custom fields');
      for (const cf of filled) {
        const v = Array.isArray(cf.value) ? cf.value.join(', ') : cf.value;
        L.push(`- **${cf.name}:** ${v}`);
      }
      L.push('');
    }
  }

  if (issue.description?.trim()) {
    L.push('## Description');
    L.push('');
    L.push(issue.description.trim());
    L.push('');
  }

  if (issue.attachments?.length) {
    L.push('## Attachments');
    for (const a of issue.attachments) {
      L.push(`- [${a.filename}](${a.content_url})${a.filesize ? ` — ${fmtSize(a.filesize)}` : ''}`);
    }
    L.push('');
  }

  if (issue.relations?.length) {
    L.push('## Relations');
    for (const r of issue.relations) {
      const otherId = r.issue_to_id ?? r.issue_id;
      L.push(`- **#${otherId}** — ${r.relation_type}`);
    }
    L.push('');
  }

  if (issue.children?.length) {
    L.push('## Subtasks');
    for (const c of issue.children) {
      L.push(`- **#${c.id}** — ${c.subject}${c.tracker ? ` (${c.tracker.name})` : ''}`);
    }
    L.push('');
  }

  const journals = (issue.journals || []).filter(j => j.notes?.trim() || j.details?.length);
  if (journals.length) {
    L.push('## History');
    for (const j of journals) {
      L.push('');
      L.push(`### ${j.created_on} — ${j.user?.name || 'unknown'}`);
      L.push('');
      if (j.notes?.trim()) { L.push(j.notes.trim()); L.push(''); }
      if (j.details?.length) {
        L.push('**Changes:**');
        for (const d of j.details) {
          const line = renderDetail(d, resolver, cfNames);
          if (line) L.push(`- ${line}`);
        }
        L.push('');
      }
      L.push('---');
    }
  }

  return L.join('\n');
}

function renderDetail(d, resolver, cfNames) {
  if (d.property === 'attr') {
    const oldV = resolver.resolveAttr(d.name, d.old_value);
    const newV = resolver.resolveAttr(d.name, d.new_value);
    return `${ATTR_LABELS[d.name] || d.name}: ${oldV} → ${newV}`;
  }
  if (d.property === 'cf') {
    const name = cfNames[String(d.name)] || `custom_field#${d.name}`;
    return `${name}: ${d.old_value || '—'} → ${d.new_value || '—'}`;
  }
  if (d.property === 'attachment') {
    return d.old_value ? `Attachment removed: ${d.old_value}` : `Attachment added: ${d.new_value}`;
  }
  if (d.property === 'relation') {
    return d.old_value ? 'Relation removed' : 'Relation added';
  }
  return `${d.property}.${d.name}: ${d.old_value} → ${d.new_value}`;
}

export function buildSingleMarkdown(issue, resolver) {
  return renderIssue(issue, resolver) + '\n';
}

export function buildBulkMarkdown(issues, resolver, { projectName, exportedAt }) {
  const L = [];
  L.push(`# ${projectName || 'Redmine'} — export`);
  L.push('');
  L.push(`_Exported on ${exportedAt.toISOString().slice(0, 19).replace('T', ' ')} · ${issues.length} issues_`);
  L.push('');
  L.push('## Contents');
  for (const i of issues) {
    L.push(`- [#${i.id} — ${i.subject}](#${i.id}-${slugAnchor(i.subject)})`);
  }
  L.push('');
  L.push('---');
  L.push('');
  for (const issue of issues) {
    L.push(renderIssue(issue, resolver));
    L.push('');
    L.push('---');
    L.push('');
  }
  return L.join('\n');
}

function slugAnchor(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}