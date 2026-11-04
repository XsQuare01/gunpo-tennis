
export const SOURCE_URL = 'https://www.gunpouc.or.kr/fmcs/157#proc_list_tab';
export const COURTS = Array.from({ length: 9 }, (_, i) => ({ number: i + 1, code: String(61 + i) }));
const BOOKABLE = new Set(['10', '11', '15']);
const koreaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
export function koreaToday(now = new Date()) {
  return koreaDateFormatter.format(now);
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function normalizeCourt(court, date, days, times) {
  if (!Array.isArray(days) || !Array.isArray(times)) throw new Error('Invalid upstream response');
  const day = days.find(row => String(row.date).replaceAll('-', '') === date.replaceAll('-', ''));
  if (!day || typeof day.state_cd !== 'string' || typeof day.state_nm !== 'string') throw new Error('Missing date status');
  const usable = times.filter(row => row.start_time != null && row.end_time != null);
  const slots = usable.map(row => {
    if (!/^\d{2}:\d{2}$/.test(row.start_time) || !/^\d{2}:\d{2}$/.test(row.end_time) || !['N', 'Y', 'E'].includes(row.use_yn)) throw new Error('Unknown time format');
    const status = row.use_yn === 'Y' ? 'booked' : row.use_yn === 'E' ? 'closed' : BOOKABLE.has(day.state_cd) ? 'available' : 'unavailable';
    // Never relay booking names or identifiers. Only availability leaves the server.
    return { start: row.start_time, end: row.end_time, status, price: row.rent_amt != null && Number.isFinite(Number(row.rent_amt)) ? Number(row.rent_amt) : null };
  }).sort((a, b) => a.start.localeCompare(b.start));
  if (new Set(slots.map(slot => slot.start + slot.end)).size !== slots.length) throw new Error('Duplicate slots');
  return { number: court.number, code: court.code, dayStatus: day.state_nm, slots, error: null };
}

async function upstream(endpoint, court, date, fetcher, deadline) {
  const url = new URL('/rest/facilities/' + endpoint, 'https://www.gunpouc.or.kr');
  url.search = new URLSearchParams({ company_code: 'GUNPO02', part_code: '14', place_code: court.code, base_date: date.replaceAll('-', ''), rent_type: '1001', mem_no: '' }).toString();
  if (fetcher === fetch) await new Promise(resolve => setTimeout(resolve, 300));
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('Lookup time budget exhausted');
  const response = await fetcher(url.toString(), {
    headers: { 'User-Agent': 'CourtAvailability/1.0', Accept: 'application/json', Referer: 'https://www.gunpouc.or.kr/fmcs/157' },
    redirect: 'manual',
    signal: AbortSignal.timeout(Math.min(10000, remaining)),
  });
  if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Upstream data unavailable');
  return data;
}
export async function fetchAvailability(date, fetcher = fetch) {
  const courts = [];
  const deadline = Date.now() + 45000;
  // 18 fixed public requests at most; no automatic polling or arbitrary proxy URLs.
  for (const court of COURTS) {
    try {
      if (Date.now() >= deadline) throw new Error('Lookup time budget exhausted');
      const days = await upstream('place_month_state_list', court, date, fetcher, deadline);
      const times = await upstream('place_time_state_list', court, date, fetcher, deadline);
      courts.push(normalizeCourt(court, date, days, times));
    } catch {
      courts.push({ number: court.number, code: court.code, dayStatus: '확인 필요', slots: [], error: '현황을 불러오지 못했습니다.' });
    }
  }
  return { date, checkedAt: new Date().toISOString(), source: SOURCE_URL, courts };
}
