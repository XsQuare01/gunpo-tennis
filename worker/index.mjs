import { fetchAvailability, koreaToday, validDate } from '../lib/availability.mjs';

const FRESH_MS = 30_000;
export async function handleRequest(request, env, ctx = {}, dependencies = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = new Set(String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  const headers = {
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  const json = (data, status = 200) => Response.json(data, { status, headers });
  if (origin && !allowed.has(origin)) return json({ error: '이 페이지 주소는 조회 API에 허용되어 있지 않습니다.' }, 403);
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  if (url.pathname !== '/api/availability' && url.pathname !== '/health') return json({ error: '요청한 주소가 없습니다.' }, 404);
  if (request.method === 'OPTIONS') {
    const requestedMethod = request.headers.get('Access-Control-Request-Method');
    if (requestedMethod && requestedMethod !== 'GET') return json({ error: 'GET 요청만 지원합니다.' }, 405);
    return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept', 'Access-Control-Max-Age': '86400',
    } });
  }
  if (request.method !== 'GET') return json({ error: 'GET 요청만 지원합니다.' }, 405);
  if (url.pathname === '/health') return json({ ok: true, service: 'gunpo-tennis-api' });

  const date = url.searchParams.get('date');
  if (!validDate(date)) return json({ error: '올바른 날짜를 선택해 주세요.' }, 400);
  const difference = (Date.parse(date) - Date.parse(koreaToday())) / 86400000;
  if (difference < 0 || difference > 60) return json({ error: '오늘부터 60일 이내의 날짜를 선택해 주세요.' }, 400);

  const cache = dependencies.cache ?? globalThis.caches?.default;
  const key = new Request(url.origin + '/api/availability?date=' + date);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        const age = Date.now() - Date.parse(data.checkedAt);
        if (age >= 0 && age < FRESH_MS) return json({ ...data, cached: true });
      }
    } catch { /* Cache failures must not prevent a live lookup. */ }
  }
  try {
    const lookup = dependencies.lookup ?? fetchAvailability;
    const data = await lookup(date);
    if (data.courts.every(c => !!c.error)) {
      return json({ ...data, cached: false, error: '군포 사이트에서 현황을 가져오지 못했습니다. 잠시 후 다시 확인해 주세요.' }, 502);
    }
    if (cache && data.courts.every(c => !c.error)) {
      const write = cache.put(key, Response.json(data, { headers: { 'Cache-Control': 'public, max-age=30' } })).catch(() => {});
      if (ctx.waitUntil) ctx.waitUntil(write); else await write;
    }
    return json({ ...data, cached: false });
  } catch {
    return json({ error: '현황 조회에 실패했습니다. 잠시 후 다시 확인해 주세요.' }, 502);
  }
}
export default { fetch: handleRequest };
