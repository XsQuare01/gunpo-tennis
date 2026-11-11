import { useState, type FormEvent } from 'react';
import { type RefundFields } from '../lib/refund-docx.mjs';

const officialGuide = 'https://www.gunpouc.or.kr/fmcs/68?action=read&action-value=23be719ec6e4d48ac05c3a2c2a94331c';
const templateUrl = import.meta.env.BASE_URL + 'refund-form.docx';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function RefundForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value).trim()])) as RefundFields;
    setMessage('');
    setError('');
    if (Object.entries(fields).some(([key, value]) => !value && key !== 'paidOn' && key !== 'addressDetail')) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    if (Number(fields.refund) > Number(fields.paid)) {
      setError('반환 신청 금액은 결제 금액 이하여야 합니다.');
      return;
    }

    setBusy(true);
    try {
      const [{ fillRefundDocx }, response] = await Promise.all([import('../lib/refund-docx.mjs'), fetch(templateUrl)]);
      if (!response.ok) throw new Error('Could not load the blank form');
      const bytes = fillRefundDocx(new Uint8Array(await response.arrayBuffer()), fields);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = '시민체육광장-대관환불신청서.docx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage('신청서를 내려받았습니다. 서명 또는 도장 후 제출해 주세요.');
    } catch {
      setError('신청서를 만들지 못했습니다. 다시 시도하거나 빈 양식을 내려받아 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="refund-panel">
    <summary>대관 환불 신청서 작성</summary>
    <div className="refund-content">
      <p>시민체육광장 테니스장 반환청구서를 작성합니다. 입력한 정보는 이 화면에서 문서를 만드는 데 사용됩니다.</p>
      <p>예약자 본인 명의 계좌를 입력하세요. 가상계좌는 사용할 수 없습니다.</p>
      <form onSubmit={download} onReset={() => { setMessage(''); setError(''); }} autoComplete="off">
        <fieldset disabled={busy}>
          <legend>대관 정보</legend>
          <div className="refund-grid">
            <label className="refund-wide">이용 예정일과 코트<input name="reservation" required maxLength={40} placeholder="예 11월 21일 1코트 14:00–16:00" /></label>
            <label>납입일 (선택)<input type="date" name="paidOn" /></label>
            <label>결제 금액 (원)<input type="number" name="paid" required min="1" max="9999999" step="1" /></label>
            <label>반환 신청 금액 (원)<input type="number" name="refund" required min="1" max="9999999" step="1" /></label>
            <label className="refund-wide">반환 신청 사유<input name="reason" required maxLength={60} /></label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>예약자와 환불 계좌</legend>
          <div className="refund-grid">
            <label>예약자 이름 (예금주)<input name="name" required maxLength={18} /></label>
            <label>연락처<input name="phone" type="tel" required maxLength={24} /></label>
            <label>생년월일<input name="birth" type="date" required max={today()} /></label>
            <label>작성일<input name="writtenOn" type="date" required defaultValue={today()} /></label>
            <label className="refund-wide">주소<input name="address" required maxLength={48} /></label>
            <label className="refund-wide">상세 주소 (선택)<input name="addressDetail" maxLength={40} /></label>
            <label>은행명<input name="bank" required maxLength={16} /></label>
            <label>계좌번호<input name="account" inputMode="numeric" pattern="[0-9\\-]+" title="숫자와 하이픈을 입력하세요" required maxLength={32} /></label>
          </div>
        </fieldset>
        <div className="refund-actions">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? '문서 만드는 중…' : '작성한 신청서 내려받기 (.docx)'}</button>
          <button className="clear-selection" type="reset" disabled={busy}>입력 지우기</button>
          <a href={templateUrl} download="대관환불서류.docx">빈 양식</a>
        </div>
        {error && <p role="alert" className="refund-error">{error}</p>}
        {message && <p role="status">{message}</p>}
      </form>
      <p>서명 또는 도장 후 이메일 <a href="mailto:gpuc@gunpouc.or.kr">gpuc@gunpouc.or.kr</a> 또는 팩스 031-390-7627로 제출하세요. 문의는 <a href="tel:0313907677">031-390-7677</a>입니다.</p>
      <p><a href={officialGuide} target="_blank" rel="noreferrer">군포도시공사 환불 안내</a></p>
    </div>
  </details>;
}
