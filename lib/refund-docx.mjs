import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const documentPath = 'word/document.xml';
const paragraphPattern = /<w:p(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g;
const textPattern = /<w:t(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:t>)/g;
const signatureId = 'rIdRefundSignature';
const signaturePath = 'word/media/refund-signature.png';

function textRun(value, pointSize = 10) {
  const safe = value.replace(/[\u0000-\u001f\ufffe\uffff]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const size = pointSize * 2;
  return '<w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/><w:color w:val="000000"/><w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr><w:t xml:space="preserve">' + safe + '</w:t></w:r>';
}

function appendRuns(paragraph, runs) {
  if (paragraph.endsWith('/>')) return paragraph.slice(0, -2) + '>' + runs + '</w:p>';
  return paragraph.slice(0, -6) + runs + '</w:p>';
}

function signatureRun(image, id, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height) * 12700;
  const cx = Math.max(1, Math.round(image.width * scale));
  const cy = Math.max(1, Math.round(image.height * scale));
  const extent = 'cx="' + cx + '" cy="' + cy + '"';
  return `<w:r><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent ${extent}/><wp:docPr id="${id}" name="Refund signature ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Signature.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${signatureId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext ${extent}/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function addSignature(parts, image) {
  const relationsPath = 'word/_rels/document.xml.rels';
  const typesPath = '[Content_Types].xml';
  const relations = strFromU8(parts[relationsPath]);
  const types = strFromU8(parts[typesPath]);
  const relation = '<Relationship Id="' + signatureId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/refund-signature.png"/>';
  parts[relationsPath] = strToU8(relations.replace('</Relationships>', relation + '</Relationships>'));
  if (!/Extension="png"/i.test(types)) {
    parts[typesPath] = strToU8(types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>'));
  }
  parts[signaturePath] = image.bytes;
}

export function fillRefundDocx(template, fields, image) {
  const parts = unzipSync(template);
  const xml = strFromU8(parts[documentPath]);
  const paragraphs = [...xml.matchAll(paragraphPattern)];
  if (paragraphs.length !== 70 || !paragraphs[47][0].replace(/<[^>]+>/g, '').includes('(인)') || !paragraphs[61][0].replace(/<[^>]+>/g, '').includes('계좌번호')) {
    throw new Error('Unexpected refund form template');
  }
  if (image) {
    if (![image.width, image.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid signature size');
    addSignature(parts, image);
  }

  const [year, month, day] = fields.writtenOn.split('-');
  const money = value => Number(value).toLocaleString('ko-KR');
  // Original headings and table settings stay in place. Only values are added as new runs.
  const values = new Map([
    [30, fields.paidOn],
    [31, money(fields.paid)],
    [34, money(fields.refund)],
    [35, fields.name + (image ? ' ' : ' (인)')],
    [37, ' 시민체육광장 테니스장'],
    [39, ' ' + fields.reservation],
    [41, ' ' + fields.reason],
    [47, '성    명 :  ' + fields.name + (image ? '  ' : '        (인)')],
    [48, ' ' + fields.phone],
    [49, ' ' + fields.birth],
    [50, ' ' + fields.address],
    [51, fields.addressDetail],
    [54, year + ' 년     ' + month + ' 월     ' + day + ' 일'],
    [64, fields.bank],
    [67, fields.account],
    [68, fields.name],
  ]);
  const replace = new Set([47, 51, 54]);
  const narrowCells = new Set([30, 31, 34, 35, 64, 67, 68]);
  let index = 0;
  const compact = xml.replace('w:val="3461" w:hRule="atLeast"', 'w:val="2220" w:hRule="atLeast"')
    .replace(/(<w:trPr>)(?=<w:trHeight w:val="485")/g, '$1<w:cantSplit/>');
  parts[documentPath] = strToU8(compact.replace(paragraphPattern, paragraph => {
    const position = index++;
    if (!values.has(position)) return paragraph;
    const value = values.get(position);
    if (replace.has(position)) paragraph = paragraph.replace(textPattern, '');
    // Keep continuation lines under the claimant details instead of at the left page edge.
    if (position >= 47 && position <= 51) paragraph = paragraph.replace('w:firstLine="4426"', 'w:left="4426"');
    if (position === 54) paragraph = paragraph.replace(/(<w:pPr>[\s\S]*?)(<w:rPr>)/, '$1<w:jc w:val="right"/>$2');
    let runs = value ? textRun(value, narrowCells.has(position) ? 9 : 10) : '';
    if (image && position === 35) runs += signatureRun(image, 1, 36, 14);
    if (image && position === 47) runs += signatureRun(image, 2, 52, 17);
    return runs ? appendRuns(paragraph, runs) : paragraph;
  }));
  return zipSync(parts);
}
