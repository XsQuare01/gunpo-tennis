import { appendFileSync } from 'node:fs';
import { normalizeApiOrigin } from './public-config.mjs';
const apiOrigin = normalizeApiOrigin(process.env.VITE_API_BASE_URL || '', { required: true, allowLocal: false });
const [owner, repository] = String(process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner || !repository) throw new Error('GITHUB_REPOSITORY is required.');
const base = repository.toLowerCase() === owner.toLowerCase() + '.github.io' ? '/' : '/' + repository + '/';
appendFileSync(process.env.GITHUB_ENV, 'VITE_BASE_PATH=' + base + '\nVITE_API_BASE_URL=' + apiOrigin + '\n');
console.log('Pages path: ' + base);
console.log('API origin: ' + apiOrigin);
