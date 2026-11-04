import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiOrigin } from '../scripts/public-config.mjs';
test('deployment URLs are explicit credential-free origins', () => {
  assert.throws(() => normalizeApiOrigin('', { required: true }));
  assert.throws(() => normalizeApiOrigin('http://localhost:8787', { allowLocal: false }));
  assert.throws(() => normalizeApiOrigin('https://gunpo-tennis-api.YOUR-SUBDOMAIN.workers.dev'));
  assert.throws(() => normalizeApiOrigin('https://user:password@example.com'));
  assert.throws(() => normalizeApiOrigin('https://example.com/api'));
  assert.throws(() => normalizeApiOrigin('https://example.com?token=value'));
  assert.equal(normalizeApiOrigin('https://tennis.example/'), 'https://tennis.example');
  assert.equal(normalizeApiOrigin(''), '');
  assert.equal(normalizeApiOrigin('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
});
