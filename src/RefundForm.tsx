import { useState, type FormEvent } from 'react';
import { type RefundFields, type RefundSignature } from '../lib/refund-docx.mjs';

const officialGuide = 'https://www.gunpouc.or.kr/fmcs/68?action=read&action-value=23be719ec6e4d48ac05c3a2c2a94331c';
const templateUrl = import.meta.env.BASE_URL + 'refund-form.docx';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const courtNumbers = Array.from({ length: 9 }, (_, index) => index + 1);
const hourText = (hour: number) => String(hour).padStart(2, '0') + ':00';
const sessions = Array.from({ length: 8 }, (_, index) => hourText(6 + index * 2) + '–' + hourText(8 + index * 2));
const datePattern = '[0-9]{8}|[0-9]{4}-[0-9]{2}-[0-9]{2}';

function Required() {
  return <span className="refund-required" aria-hidden="true"> *</span>;
}

function normalizeDate(value: string) {
  const compact = value.replaceAll('-', '');
  if (!/^[0-9]{8}$/.test(compact)) return null;
  const date = compact.slice(0, 4) + '-' + compact.slice(4, 6) + '-' + compact.slice(6);
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

async function loadSignature(file: File): Promise<RefundSignature> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('5MB 이하의 PNG 또는 JPG 이미지를 선택해 주세요.');
  }
  const image = await createImageBitmap(file).catch(() => null);
  if (!image) throw new Error('서명 이미지를 열 수 없습니다. 다른 PNG 또는 JPG 파일을 선택해 주세요.');
  try {
    const scale = Math.min(1, 800 / image.width, 400 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('서명 이미지를 변환할 수 없습니다.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('서명 이미지를 변환할 수 없습니다.');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally {
    image.close();
  }
}

export default function RefundForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    setMessage('');
    setError('');
    const visit = normalizeDate(value('visit'));
    const paidOn = value('paidOn') ? normalizeDate(value('paidOn')) : '';
    const birth = normalizeDate(value('birth'));
    const writtenOn = normalizeDate(value('writtenOn'));
    const invalidDate = [
      [visit, 'visit', '이용 예정일'],
      [paidOn, 'paidOn', '납입일'],
      [birth && birth <= today() ? birth : null, 'birth', '생년월일'],
      [writtenOn, 'writtenOn', '작성일'],
    ].find(([date]) => date === null);
    if (invalidDate) {
      setError(invalidDate[2] + '을(를) 실제 날짜로 입력해 주세요.');
      (form.elements.namedItem(String(invalidDate[1])) as HTMLInputElement)?.focus();
      return;
    }

    const fields: RefundFields = {
      paidOn: paidOn ?? '',
      paid: value('paid'),
      refund: value('refund'),
      name: value('name'),
      reservation: visit + ' ' + value('court') + '코트 ' + value('session'),
      reason: value('reason'),
      phone: value('phone'),
      birth: birth ?? '',
      address: value('address'),
      addressDetail: value('addressDetail'),
      writtenOn: writtenOn ?? '',
      bank: value('bank'),
      account: value('account'),
    };
    if (['name', 'phone', 'address', 'bank', 'reason', 'account'].some(key => !value(key))) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    if (Number(fields.refund) > Number(fields.paid)) {
      setError('반환 신청 금액은 결제 금액 이하여야 합니다.');
      (form.elements.namedItem('refund') as HTMLInputElement)?.focus();
      return;
    }

    setBusy(true);
    try {
      const file = data.get('signature');
      let signature: RefundSignature | undefined;
      if (file instanceof File && file.size) {
        try {
          signature = await loadSignature(file);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '서명 이미지를 읽지 못했습니다.');
          return;
        }
      }
      const [{ fillRefundDocx }, response] = await Promise.all([import('../lib/refund-docx.mjs'), fetch(templateUrl)]);
      if (!response.ok) throw new Error('Could not load the blank form');
      const bytes = fillRefundDocx(new Uint8Array(await response.arrayBuffer()), fields, signature);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = '시민체육광장-대관환불신청서.docx';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(signature ? '서명 이미지를 포함한 신청서를 내려받았습니다.' : '신청서를 내려받았습니다. 서명 또는 도장 후 제출해 주세요.');
    } catch {
      setError('신청서를 만들지 못했습니다. 다시 시도하거나 빈 양식을 내려받아 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="refund-panel">
    <summary>대관 환불 신청서 작성</summary>
    <div className="refund-content">
      <p>시민체육광장 테니스장 반환청구서를 작성합니다. 입력한 정보와 서명 이미지는 브라우저 안에서 처리됩니다.</p>
      <p id="refund-date-hint">날짜는 숫자 8자리로 입력하세요. 예: 19900101</p>
      <p><Required /> 표시가 있는 항목은 필수입니다.</p>
      <form onSubmit={download} onReset={() => { setMessage(''); setError(''); }} autoComplete="off">
        <fieldset disabled={busy}>
          <legend>대관 정보</legend>
          <div className="refund-grid refund-booking-grid">
            <label><span>이용 예정일<Required /></span><input name="visit" inputMode="numeric" pattern={datePattern} maxLength={10} placeholder="YYYYMMDD" aria-describedby="refund-date-hint" required /></label>
            <label><span>코트<Required /></span><select name="court" defaultValue="" required><option value="" disabled>선택</option>{courtNumbers.map(number => <option key={number} value={number}>{number}코트</option>)}</select></label>
            <label><span>시간대<Required /></span><select name="session" defaultValue="" required><option value="" disabled>선택</option>{sessions.map(session => <option key={session}>{session}</option>)}</select></label>
          </div>
          <div className="refund-grid">
            <label>납입일 (선택)<input name="paidOn" inputMode="numeric" pattern={datePattern} maxLength={10} placeholder="YYYYMMDD" aria-describedby="refund-date-hint" /></label>
            <label><span>결제 금액 (원)<Required /></span><input type="number" name="paid" required min="1" max="9999999" step="1" /></label>
            <label><span>반환 신청 금액 (원)<Required /></span><input type="number" name="refund" required min="1" max="9999999" step="1" /></label>
            <label className="refund-wide"><span>반환 신청 사유<Required /></span><input name="reason" required maxLength={60} /></label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>예약자와 환불 계좌</legend>
          <p>예약자 본인 명의 계좌를 입력하세요. 가상계좌는 사용할 수 없습니다.</p>
          <div className="refund-grid">
            <label><span>예약자 이름 (예금주)<Required /></span><input name="name" required maxLength={18} /></label>
            <label><span>연락처<Required /></span><input name="phone" type="tel" required maxLength={24} /></label>
            <label><span>생년월일<Required /></span><input name="birth" inputMode="numeric" pattern={datePattern} maxLength={10} placeholder="예: 19900101" aria-describedby="refund-date-hint" required /></label>
            <label><span>작성일<Required /></span><input name="writtenOn" inputMode="numeric" pattern={datePattern} maxLength={10} defaultValue={today().replaceAll('-', '')} aria-describedby="refund-date-hint" required /></label>
            <label className="refund-wide"><span>주소<Required /></span><input name="address" required maxLength={48} /></label>
            <label className="refund-wide">상세 주소 (선택)<input name="addressDetail" maxLength={40} /></label>
            <label><span>은행명<Required /></span><input name="bank" required maxLength={16} /></label>
            <label><span>계좌번호<Required /></span><input name="account" inputMode="numeric" pattern="[0-9\\-]+" title="숫자와 하이픈을 입력하세요" required maxLength={32} /></label>
            <label className="refund-wide">서명 이미지 (선택)<input type="file" name="signature" accept="image/png,image/jpeg" aria-describedby="refund-signature-hint" /></label>
          </div>
          <p id="refund-signature-hint">본인 서명이 담긴 PNG 또는 JPG를 첨부하세요. 최대 5MB입니다.</p>
        </fieldset>
        <div className="refund-actions">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? '문서 만드는 중…' : '작성한 신청서 내려받기 (.docx)'}</button>
          <button className="clear-selection" type="reset" disabled={busy}>입력 지우기</button>
          <a href={templateUrl} download="대관환불서류.docx">빈 양식</a>
        </div>
        {error && <p role="alert" className="refund-error">{error}</p>}
        {message && <p role="status">{message}</p>}
      </form>
      <p>서명이나 도장을 확인한 뒤 이메일 <a href="mailto:gpuc@gunpouc.or.kr">gpuc@gunpouc.or.kr</a> 또는 팩스 031-390-7627로 제출하세요. 문의는 <a href="tel:0313907677">031-390-7677</a>입니다.</p>
      <p><a href={officialGuide} target="_blank" rel="noreferrer">군포도시공사 환불 안내</a></p>
    </div>
  </details>;
}
