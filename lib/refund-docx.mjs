import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const documentPath = 'word/document.xml';
const paragraphPattern = /<w:p(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g;
const textPattern = /<w:t(?=[\s>])[^>]*>[\s\S]*?<\/w:t>/g;

function wordText(value) {
  const escaped = value.replace(/[\u0000-\u001f\ufffe\uffff]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<w:t xml:space="preserve">' + escaped + '</w:t>';
}

function replaceParagraphText(paragraph, value) {
  const text = wordText(value);
  let first = true;
  const replaced = paragraph.replace(textPattern, () => {
    if (!first) return '';
    first = false;
    return text;
  });
  if (!first) return replaced;
  const run = '<w:r>' + text + '</w:r>';
  return paragraph.endsWith('/>') ? paragraph.slice(0, -2) + '>' + run + '</w:p>' : paragraph.replace('</w:p>', run + '</w:p>');
}

export function fillRefundDocx(template, fields) {
  const parts = unzipSync(template);
  const xml = strFromU8(parts[documentPath]);
  const paragraphs = [...xml.matchAll(paragraphPattern)];
  if (paragraphs.length !== 70 || !paragraphs[47][0].replace(/<[^>]+>/g, '').includes('(인)') || !paragraphs[61][0].replace(/<[^>]+>/g, '').includes('계좌번호')) {
    throw new Error('Unexpected refund form template');
  }

  const [year, month, day] = fields.writtenOn.split('-');
  const money = value => value ? Number(value).toLocaleString('ko-KR') : '';
  const entries = new Map([
    [30, fields.paidOn],
    [31, money(fields.paid)],
    [34, money(fields.refund)],
    [35, fields.name + ' (인)'],
    [37, '체육시설명  시민체육광장 테니스장'],
    [39, '승인기간  ' + fields.reservation],
    [41, '반환 신청 사유  ' + fields.reason],
    [47, '성    명 :  ' + fields.name + '        (인)'],
    [48, '연 락 처 :  ' + fields.phone],
    [49, '생년월일 :  ' + fields.birth],
    [50, '주    소 :  ' + fields.address],
    [51, fields.addressDetail],
    [54, year + ' 년     ' + month + ' 월     ' + day + ' 일'],
    [64, fields.bank],
    [67, fields.account],
    [68, fields.name],
  ]);
  let index = 0;
  parts[documentPath] = strToU8(xml.replace(paragraphPattern, paragraph => {
    const value = entries.get(index++);
    return value ? replaceParagraphText(paragraph, value) : paragraph;
  }));
  return zipSync(parts);
}
