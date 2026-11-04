import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const origins = String(config.vars?.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
if (!origins.length || origins.some(value => {
  try {
    const url = new URL(value);
    return url.protocol !== 'https:' || url.origin !== value || url.username || url.password || ['localhost','127.0.0.1'].includes(url.hostname) || value.includes('*');
  } catch { return true; }
})) throw new Error('Set production ALLOWED_ORIGINS to your exact HTTPS Pages origin (no path or trailing slash). See DEPLOY.md.');
console.log('Deploying Worker: ' + config.name);
console.log('Allowed browser origins: ' + origins.join(', '));
console.log('Use Workers Free in your Cloudflare account. This command does not change your account plan.');
