export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'item';
}

export function sanitizeFilename(s) {
  return String(s || 'export')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'export';
}

export function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}