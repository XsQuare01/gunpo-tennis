import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../worker/index.mjs';
import { koreaToday } from '../lib/availability.mjs';
const date = koreaToday();
const env = { ALLOWED_ORIGINS: 'https://xsquare01.github.io,https://example.org' };
const request = (origin = 'https://xsquare01.github.io', path = '/api/availability?date=' + date, method = 'GET') =>
  new Request('https://tennis.example' + path, { method, headers: origin ? { Origin: origin } : {} });
const data = () => ({ date, checkedAt: new Date().toISOString(), courts: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, slots: [], error: null })) });
test('exact CORS allowlist is applied before upstream requests', async () => {
  let calls = 0; const deps = { cache: false, lookup: async () => { calls++; return data(); } };
  const ok = await handleRequest(request(), env, {}, deps);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://xsquare01.github.io');
  assert.equal(ok.headers.get('Vary'), 'Origin');
  const denied = await handleRequest(request('https://other.example'), env, {}, deps);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls, 1);
});
test('preflight accepts GET; invalid dates, unknown routes and POST do not fetch', async () => {
  const preflight = new Request('https://tennis.example/api/availability', { method: 'OPTIONS', headers: { Origin: 'https://xsquare01.github.io', 'Access-Control-Request-Method': 'GET' } });
  assert.equal((await handleRequest(preflight, env)).status, 204);
  const future = new Date(date); future.setUTCDate(future.getUTCDate() + 61);
  for (const value of ['', '2026-02-30', '2020-01-01', future.toISOString().slice(0,10)]) {
    assert.equal((await handleRequest(request(undefined, '/api/availability?date=' + value), env)).status, 400);
  }
  assert.equal((await handleRequest(request(undefined, '/proxy'), env)).status, 404);
  assert.equal((await handleRequest(request(undefined, '/api/availability', 'POST'), env)).status, 405);
  assert.equal((await handleRequest(request(null, '/health'), env)).status, 200);
});
test('cache applies the current request origin and expires after 30 seconds', async () => {
  let stored, calls = 0;
  const cache = { match: async () => stored?.clone(), put: async (key, response) => { stored = response.clone(); } };
  const deps = { cache, lookup: async () => { calls++; return data(); } };
  const first = await handleRequest(request(), env, {}, deps);
  assert.equal((await first.json()).cached, false);
  const second = await handleRequest(request('https://example.org'), env, {}, deps);
  assert.equal((await second.json()).cached, true);
  assert.equal(second.headers.get('Access-Control-Allow-Origin'), 'https://example.org');
  assert.equal(second.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls, 1);
  stored = Response.json({ ...data(), checkedAt: new Date(Date.now() - 31000).toISOString() });
  assert.equal((await (await handleRequest(request(), env, {}, deps)).json()).cached, false);
  assert.equal(calls, 2);
});
test('partial failures remain visible, complete failures return 502, errors are not cached', async () => {
  let writes = 0;
  const cache = { match: async () => undefined, put: async () => { writes++; } };
  const partial = data(); partial.courts[0].error = '확인 필요';
  const response = await handleRequest(request(), env, {}, { cache, lookup: async () => partial });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).courts.length, 9);
  const all = data(); all.courts.forEach(c => { c.error = '확인 필요'; });
  assert.equal((await handleRequest(request(), env, {}, { cache, lookup: async () => all })).status, 502);
  assert.equal(writes, 0);
});