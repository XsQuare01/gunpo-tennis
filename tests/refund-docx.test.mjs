import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { fillRefundDocx } from '../lib/refund-docx.mjs';

test('fills the official blank refund form without disturbing the template or adding unescaped XML', () => {
  const template = readFileSync(new URL('../public/refund-form.docx', import.meta.url));
  const sample = {
    paidOn: '2026-11-10', paid: '10000', refund: '9000', name: '테스트 신청자',
    reservation: '2026-11-21 1코트 14:00–16:00', reason: '일정 변경 & 개인 사유 <예시>',
    phone: '010-0000-0000', birth: '1990-01-01', address: '경기도 군포시 예시로 100',
    addressDetail: '101동 101호', writtenOn: '2026-11-11', bank: '예시은행', account: '000-00-000000',
  };
  const generated = fillRefundDocx(template, sample);
  const original = unzipSync(template);
  const result = unzipSync(generated);
  assert.deepEqual(Object.keys(result), Object.keys(original));
  for (const path of Object.keys(result)) {
    if (path !== 'word/document.xml') assert.deepEqual(result[path], original[path]);
  }
  const xml = strFromU8(result['word/document.xml']);
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g)].map(m => m[0]);
  assert.match(paragraphs[31], /10,000/);
  assert.match(paragraphs[34], /9,000/);
  assert.match(paragraphs[39], /1코트/);
  assert.match(paragraphs[41], /&amp; 개인 사유 &lt;예시&gt;/);
  assert.match(paragraphs[47], /테스트 신청자.*\(인\)/);
  assert.match(paragraphs[67], /000-00-000000/);
  assert.match(paragraphs[68], /테스트 신청자/);
  if (process.env.REFUND_QA_OUTPUT) writeFileSync(process.env.REFUND_QA_OUTPUT, generated);
});

test('embeds one signature image at both signing positions with unique drawing IDs', () => {
  const template = readFileSync(new URL('../public/refund-form.docx', import.meta.url));
  const sample = {
    paidOn: '', paid: '10000', refund: '9000', name: '테스트 신청자',
    reservation: '2026-11-21 1코트 14:00–16:00', reason: '일정 변경',
    phone: '010-0000-0000', birth: '1990-01-01', address: '경기도 군포시 예시로 100',
    addressDetail: '101동 101호', writtenOn: '2026-11-11', bank: '예시은행', account: '000-00-000000',
  };
  const bytes = process.env.REFUND_QA_SIGNATURE ? readFileSync(process.env.REFUND_QA_SIGNATURE) : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf0sAAAAASUVORK5CYII=', 'base64');
  const generated = fillRefundDocx(template, sample, { bytes, width: 300, height: 90 });
  const result = unzipSync(generated);
  const xml = strFromU8(result['word/document.xml']);
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g)].map(m => m[0]);
  assert.match(paragraphs[35], /r:embed="rIdRefundSignature"/);
  assert.match(paragraphs[47], /r:embed="rIdRefundSignature"/);
  assert.match(paragraphs[47], /w:left="4426"/);
  assert.match(paragraphs[39], /승인기간/);
  assert.equal(new Set([...xml.matchAll(/<wp:docPr id="([0-9]+)"/g)].map(m => m[1])).size, 2);
  assert.match(strFromU8(result['word/_rels/document.xml.rels']), /Target="media\/refund-signature.png"/);
  assert.match(strFromU8(result['[Content_Types].xml']), /Extension="png" ContentType="image\/png"/);
  assert.deepEqual(Buffer.from(result['word/media/refund-signature.png']), bytes);
  if (process.env.REFUND_QA_SIGNED_OUTPUT) writeFileSync(process.env.REFUND_QA_SIGNED_OUTPUT, generated);
});
