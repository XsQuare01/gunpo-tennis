import RefundForm from './RefundForm';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, MapPin, RefreshCw, Sun, Moon, ArrowRight } from 'lucide-react';
import { requestAvailability, type Slot, type Court, type Availability } from './api';
const source = 'https://www.gunpouc.or.kr/fmcs/157#proc_list_tab';
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
function todayKorea() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function addDays(date: string, amount: number) { const day = new Date(date + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + amount); return day.toISOString().slice(0, 10); }
function saturday(date: string) { return addDays(date, (6 - new Date(date + 'T12:00:00Z').getUTCDay() + 7) % 7); }
function formatDay(date: string) { const d = new Date(date + 'T12:00:00Z'); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 ' + weekdays[d.getUTCDay()] + '요일'; }
function CourtMark() { return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="4" width="26" height="32" rx="2"/><path d="M11 4v32M29 4v32M7 20h26M11 11h18M11 29h18M20 11v18"/></svg>; }
export default function Home() {
  const [today, setToday] = useState(''), [date, setDate] = useState('');
  const [data, setData] = useState<Availability | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ court: Court; slot: Slot } | null>(null);
  const requestNumber = useRef(0), selectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const now = todayKorea(); setToday(now);
    const query = new URLSearchParams(window.location.search).get('date');
    const valid = query && /^\d{4}-\d{2}-\d{2}$/.test(query) && Number.isFinite(Date.parse(query)) && new Date(query).toISOString().slice(0, 10) === query;
    setDate(valid && query >= now && query <= addDays(now, 60) ? query : saturday(now));
  }, []);
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController(), current = ++requestNumber.current;
    setLoading(true); setError(''); setData(null); setSelectedSlot(null);
    const timeout = setTimeout(() => controller.abort(new DOMException('조회 시간이 초과되었습니다.', 'TimeoutError')), 55000);
    const url = new URL(window.location.href); url.searchParams.set('date', date); window.history.replaceState({}, '', url);
    requestAvailability(date, controller.signal)
      .then(body => { if (current === requestNumber.current) setData(body); })
      .catch(cause => { if (cause.name !== 'AbortError' && current === requestNumber.current) setError(cause.name === 'TimeoutError' ? '조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' : cause.message || '현황을 불러오지 못했습니다.'); })
      .finally(() => { clearTimeout(timeout); if (current === requestNumber.current) setLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [date, revision]);
  const courts = data?.date === date ? data.courts : [];
  const availableCount = courts.reduce((n, c) => n + c.slots.filter(s => s.status === 'available').length, 0);
  const openCourts = courts.filter(c => c.slots.some(s => s.status === 'available')).length, failed = courts.filter(c => c.error).length;
  const slotKeys = Array.from(new Set(courts.flatMap(c => c.slots.map(s => s.start + '–' + s.end)))).sort();
  const visibleTimes = onlyAvailable ? slotKeys.filter(key => courts.some(c => c.slots.some(s => s.start + '–' + s.end === key && s.status === 'available'))) : slotKeys;
  const startWeek = date ? addDays(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7)) : '';
  const week = startWeek ? Array.from({ length: 7 }, (_, i) => addDays(startWeek, i)) : [];
  const checkedTime = data ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(data.checkedAt)) : '';
  const rangeOkay = (value: string) => !!today && value >= today && value <= addDays(today, 60);
  function pick(value: string) { if (rangeOkay(value)) setDate(value); }
  function selectSlot(court: Court, slot: Slot) { setSelectedSlot({ court, slot }); setTimeout(() => selectionRef.current?.focus(), 0); }
  return <div className="app-shell">
    <a href="#main" className="skip-link">예약 현황으로 이동</a>
    <header className="site-header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="코트 한눈에 홈"><span className="brand-icon"><CourtMark/></span><span>코트 한눈에<span className="brand-sub">GUNPO TENNIS</span></span></a><a href={source} target="_blank" rel="noreferrer" className="source-link">공식 예약 사이트 <ArrowUpRight size={17}/></a></header>
    <main id="main">
      <section className="intro"><div><p className="eyebrow"><MapPin size={14}/> 군포 시민체육광장</p><h1>빈 코트 찾기,<br className="mobile-break"/> 이제 한눈에.</h1><p className="subtitle">날짜만 고르면 1–9코트의 예약 가능한 시간을 모아 보여드려요.</p></div><div className="court-art" aria-hidden="true"><div className="art-court"><i/><b/></div><div className="tennis-ball"/></div></section>
      <RefundForm />
      <section className="date-panel" aria-label="이용 날짜 선택">
        <div className="date-top"><div className="date-input-wrap"><label htmlFor="visit-date"><CalendarDays size={19}/> 이용 날짜</label><input id="visit-date" type="date" value={date} min={today} max={today ? addDays(today, 60) : undefined} onChange={e => { if (e.target.value) pick(e.target.value); }}/></div><div className="quick-dates"><button onClick={() => pick(today)} disabled={!today}>오늘</button><button onClick={() => pick(saturday(today))} disabled={!today}>이번 주말</button><button onClick={() => pick(addDays(saturday(today), 7))} disabled={!today}>다음 주말</button></div></div>
        <div className="week-nav"><button className="week-arrow" aria-label="일주일 전" disabled={!date || addDays(date, -7) < today} onClick={() => pick(addDays(date, -7))}><ChevronLeft size={19}/></button><div className="week-days">{week.map(value => { const d = new Date(value + 'T12:00:00Z'); return <button key={value} className={'day-button ' + (date === value ? 'selected ' : '') + (d.getUTCDay() === 0 ? 'sunday' : '')} aria-pressed={date === value} aria-label={formatDay(value)} disabled={!rangeOkay(value)} onClick={() => pick(value)}><span>{weekdays[d.getUTCDay()]}</span><strong>{d.getUTCDate()}</strong><span className="day-month">{d.getUTCMonth() + 1}월</span></button>; })}</div><button className="week-arrow" aria-label="일주일 후" disabled={!date || !today || addDays(date, 7) > addDays(today, 60)} onClick={() => pick(addDays(date, 7))}><ChevronRight size={19}/></button></div>
      </section>
      <section className="availability" aria-labelledby="results-title" aria-busy={loading}>
        <div className="results-heading"><div><p className="section-kicker">코트별 예약 현황</p><h2 id="results-title">{date ? formatDay(date) : '날짜를 불러오는 중'}</h2></div><button className="refresh-button" onClick={() => setRevision(n => n + 1)} disabled={loading || !date}><RefreshCw size={16} className={loading ? 'spinning' : ''}/><span>새로고침</span></button></div>
        <div className="results-toolbar"><p role="status" className="result-count">{loading ? '9개 코트의 예약 현황을 확인하고 있어요…' : error ? '조회하지 못했습니다' : data ? failed === 9 ? '9개 코트 모두 확인이 필요합니다' : <><span className="live-dot"/><strong>{availableCount}개 시간대</strong> 예약 가능 <span className="count-divider">/</span> {openCourts}개 코트{failed > 0 ? ' · ' + failed + '개 확인 필요' : ''}</> : '날짜를 선택해 주세요'}</p><label className="filter-checkbox"><input type="checkbox" checked={onlyAvailable} onChange={e => setOnlyAvailable(e.target.checked)}/> 예약 가능한 시간만</label></div>
        {error && <div className="error-box" role="alert"><CircleHelp size={22}/><div><strong>{error}</strong><p>잠시 후 새로고침하거나 공식 예약 사이트에서 확인해 주세요.</p></div><button onClick={() => setRevision(n => n + 1)}>다시 조회</button></div>}
        {failed > 0 && <div className="partial-note" role="alert">{failed}개 코트의 현황을 불러오지 못했습니다. 확인 필요는 예약 마감을 뜻하지 않습니다. 새로고침으로 다시 확인해 주세요.</div>}
        {loading ? <div className="loading-grid" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <div key={i}><span/><span/><span/></div>)}</div> : data && failed !== 9 && <>
          {(slotKeys.length === 0 || (onlyAvailable && availableCount === 0)) ? <div className="empty-state"><CalendarDays size={30}/><h3>{failed > 0 ? '조회에 성공한 코트에는 예약 가능한 시간이 없습니다.' : '선택한 날짜에 예약 가능한 시간이 없습니다.'}</h3><p>다른 날짜를 선택하거나 공식 사이트의 예약 기간을 확인해 주세요.</p></div> : <>
            <div className="desktop-table"><table><caption className="sr-only">{date} 시민체육광장 테니스장 1–9코트 예약 현황</caption><thead><tr><th scope="col" className="time-column">이용 시간 <span>한국 시간</span></th>{courts.map(c => <th key={c.number} scope="col"><strong>{c.number}<small>코트</small></strong><span>{c.error ? '확인 필요' : c.slots.filter(s => s.status === 'available').length + '개 가능'}</span></th>)}</tr></thead><tbody>{visibleTimes.map(key => <tr key={key}><th scope="row" className="time-column"><span className="time-label">{Number(key.slice(0,2)) < 18 ? <Sun size={14}/> : <Moon size={14}/>} {key.split('–')[0]}</span><span>{key.split('–')[1]}까지</span></th>{courts.map(c => { const s = c.slots.find(s => s.start + '–' + s.end === key); return <td key={c.number}>{c.error ? <span className="unknown-cell">확인 필요</span> : s?.status === 'available' ? <button className={'available-cell ' + (selectedSlot?.court.number === c.number && selectedSlot.slot.start === s.start ? 'active' : '')} aria-label={c.number + '코트 ' + s.start + '부터 ' + s.end + '까지 예약 가능, 상세 보기'} onClick={() => selectSlot(c, s)}><Check size={14}/><span>가능</span></button> : <span className="unavailable-cell">{s?.status === 'booked' ? '완료' : s?.status === 'closed' ? '마감' : s ? '불가' : '—'}</span>}</td>; })}</tr>)}</tbody></table></div>
            <div className="mobile-courts">{courts.filter(c => !onlyAvailable || c.error || c.slots.some(s => s.status === 'available')).map(c => { const available = c.slots.filter(s => s.status === 'available'); return <article key={c.number} className="mobile-court"><div><h3>{c.number}코트</h3><span>{c.error ? '확인 필요' : available.length ? available.length + '개 시간 가능' : c.dayStatus}</span></div><div className="slot-chips">{c.error ? <p>새로고침으로 다시 확인해 주세요.</p> : available.length ? available.map(s => <button key={s.start} aria-label={c.number + '코트 ' + s.start + '부터 ' + s.end + '까지 예약 가능, 상세 보기'} onClick={() => selectSlot(c,s)}>{s.start}–{s.end}<ArrowUpRight size={14}/></button>) : <p>예약 가능한 시간이 없습니다.</p>}</div></article>; })}</div>
          </>}
          <div className="table-bottom"><div className="legend"><span><i className="legend-available"/> 예약 가능</span><span><i className="legend-booked"/> 완료·마감·불가</span></div><p><Clock3 size={13}/>{checkedTime} 조회{data.cached ? ' · 30초 이내 결과' : ''}</p></div>
        </>}
      </section>
      {selectedSlot && <section className="selection-panel" ref={selectionRef} tabIndex={-1} aria-label="선택한 코트와 시간"><div><p>선택한 시간</p><h3>{selectedSlot.court.number}코트 <span>{selectedSlot.slot.start}–{selectedSlot.slot.end}</span></h3><p>{formatDay(date)}{selectedSlot.slot.price != null ? ' · ' + selectedSlot.slot.price.toLocaleString('ko-KR') + '원' : ''}</p></div><div className="selection-actions"><form action="https://www.gunpouc.or.kr/fmcs/157#proc_list_tab" method="post" target="_blank"><input type="hidden" name="center" value="GUNPO02"/><input type="hidden" name="part" value="14"/><input type="hidden" name="place" value={selectedSlot.court.code}/><input type="hidden" name="base_date" value={date.replaceAll('-','')}/><input type="hidden" name="rent_type" value="1001"/><input type="hidden" name="facilities_type" value="T"/><button className="primary-button" type="submit">공식 사이트에서 예약 <ArrowUpRight size={17}/></button></form><button className="clear-selection" onClick={() => setSelectedSlot(null)}>선택 해제</button></div><p className="selection-help">새 탭에서 선택한 코트와 날짜를 조회합니다. 실제 예약은 공식 사이트에서 진행해 주세요.</p></section>}
      <aside className="guide"><div className="guide-icon"><CircleHelp size={20}/></div><div><h2>예약 전에 확인해 주세요</h2><p>잔여분 예약은 이용일 14일 전 오전 10시부터 전날 23:59까지 가능합니다. 예약 가능 여부는 수시로 달라지므로 최종 현황은 공식 사이트에서 확인해 주세요.</p><p className="guide-small">이 페이지는 군포도시공사의 공개 예약 현황을 모아 보여주는 개인용 조회 도구입니다. 예약·결제 기능은 제공하지 않습니다.</p></div><a href={source} target="_blank" rel="noreferrer" aria-label="군포도시공사 예약 안내 보기"><ArrowRight size={20}/></a></aside>
    </main>
    <footer><span>코트 한눈에 <span className="footer-dot">·</span> 시민체육광장</span><span>데이터 출처 <a href={source} target="_blank" rel="noreferrer">군포도시공사 <ArrowUpRight size={13}/></a></span></footer>
  </div>;
}
