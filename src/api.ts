export type Slot = { start: string; end: string; status: 'available' | 'booked' | 'closed' | 'unavailable'; price: number | null };
export type Court = { number: number; code: string; slots: Slot[]; dayStatus: string; error: string | null };
export type Availability = { date: string; checkedAt: string; cached: boolean; courts: Court[] };

export async function requestAvailability(date: string, signal: AbortSignal): Promise<Availability> {
  const origin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(origin + '/api/availability?date=' + encodeURIComponent(date), {
      signal, credentials: 'omit', headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('조회 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  let body: Availability & { error?: string };
  try { body = await response.json(); }
  catch { throw new Error('조회 서버가 정상 응답을 보내지 않았습니다. 잠시 후 다시 시도해 주세요.'); }
  if (!response.ok) throw new Error(body.error || '현황을 불러오지 못했습니다.');
  if (body.date !== date || !Array.isArray(body.courts) || body.courts.length !== 9 || !Number.isFinite(Date.parse(body.checkedAt))) {
    throw new Error('조회 결과를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  return body;
}
