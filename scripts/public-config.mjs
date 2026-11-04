export function normalizeApiOrigin(value, { required = false, allowLocal = true } = {}) {
  const raw = value.trim();
  if (!raw) {
    if (required) throw new Error('VITE_API_BASE_URL is required. Set your deployed Worker origin in .env.local or GitHub Actions Variables. See DEPLOY.md.');
    return '';
  }
  let url;
  try { url = new URL(raw); } catch { throw new Error('VITE_API_BASE_URL must be an absolute URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('VITE_API_BASE_URL must contain only the origin: https://your-api.workers.dev (no path, token, or query).');
  }
  if (/YOUR-SUBDOMAIN/i.test(url.hostname) || (url.protocol !== 'https:' && !(allowLocal && local && url.protocol === 'http:')) || (!allowLocal && local)) {
    throw new Error('Set a real HTTPS Worker origin; placeholder and localhost URLs cannot be deployed by CI.');
  }
  return url.origin;
}
