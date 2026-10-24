import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

import { A4_HEIGHT_PT, A4_WIDTH_PT, buildNewsletterA4Pdf, validateNewsletterA4Pdf } from './newsletterA4Pdf.js'

const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#888' } }).png().toBuffer()

test('짧은 소식지는 A4 세로 1페이지', async () => {
  const r = await buildNewsletterA4Pdf({
    newsletter: { summary: '짧은 공지', bodyText: '오늘 교육이 있습니다.', insurerName: '한화생명', publishedAt: '2026-09-18T00:00:00Z' },
    attachments: [],
  })
  assert.equal(await validateNewsletterA4Pdf(r.buffer), 1)
  assert.deepEqual(r.warnings, [])
})

test('긴 본문은 여러 A4 페이지로 이어진다', async () => {
  const body = Array.from({ length: 120 }, (_, i) => `${i + 1}번째 문단 한국어 본문 텍스트`).join('\n')
  const r = await buildNewsletterA4Pdf({ newsletter: { summary: '긴 글', bodyText: body }, attachments: [] })
  assert.ok((await validateNewsletterA4Pdf(r.buffer)) >= 3)
})

test('이미지 비율 유지, PDF 첨부 페이지 A4 배치, 미지원 첨부는 경고', async () => {
  const src = await PDFDocument.create()
  src.addPage([842, 595]).drawCircle({ x: 400, y: 300, size: 100 })
  const r = await buildNewsletterA4Pdf({
    newsletter: { summary: '혼합', bodyText: '혼합' },
    linkPreview: { url: 'https://example.com/v', title: '영상' },
    attachments: [
      { row: { file_name: 'a.png', mime_type: 'image/png' }, buffer: await png(800, 400) },
      { row: { file_name: 'b.pdf', mime_type: 'application/pdf' }, buffer: Buffer.from(await src.save()) },
      { row: { file_name: 'c.mp4', mime_type: 'video/mp4' }, buffer: Buffer.from('x') },
      { row: { file_name: 'd.png', mime_type: 'image/png' }, buffer: null },
    ],
  })
  const doc = await PDFDocument.load(r.buffer)
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize()
    assert.ok(Math.abs(width - A4_WIDTH_PT) < 1 && Math.abs(height - A4_HEIGHT_PT) < 1)
  }
  assert.equal(r.warnings.length, 2)
})

test('한글 텍스트: 인코딩된 모든 글리프가 /W 폭 표에 있고 측정 폭과 일치, 경량 폰트로 크기 제한', async () => {
  const { PDFName } = await import('pdf-lib')
  const lines = [
    '안녕하세요 고객님',
    '보험금 청구 안내',
    '2026년 10월 24일 1,234,567원 (₩50,000) 3.5%',
    '손해사정사 소식지 ONE FC Newsletter abc',
    '(괄호), [대괄호]. “따옴표” ‘작은’ … · ※ ○ ● ■ □ ▶ ① ⑩ + - = : /',
    '한글 뒤 공백 가 나 다',
  ]
  const r = await buildNewsletterA4Pdf({ newsletter: { title: '제목 2026', bodyText: lines.join('\n') }, attachments: [] })
  assert.ok(r.buffer.length < 400 * 1024, `PDF 크기 ${r.buffer.length}`)
  const doc = await PDFDocument.load(r.buffer)
  const fonts = doc.getPages()[0].node.Resources().lookup(PDFName.of('Font'))
  const type0 = doc.context.lookup(fonts.entries()[0][1])
  const cid = doc.context.lookup(type0.lookup(PDFName.of('DescendantFonts')).get(0))
  const W = cid.lookup(PDFName.of('W')).asArray()
  const widths = new Map()
  for (let i = 0; i < W.length; ) {
    const start = W[i].asNumber()
    const next = doc.context.lookup(W[i + 1])
    if (next.asArray) {
      next.asArray().forEach((v, j) => widths.set(start + j, v.asNumber()))
      i += 2
    } else {
      for (let g = start; g <= next.asNumber(); g++) widths.set(g, W[i + 2].asNumber())
      i += 3
    }
  }
  // 같은 옵션으로 다시 임베드해 encodeText / widthOfTextAtSize 를 얻는다.
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const { readFile } = await import('node:fs/promises')
  const probe = await PDFDocument.create()
  probe.registerFontkit(fontkit)
  const bytes = await readFile(new URL('../fonts/newsletter/NotoSansKR-Regular-compact.ttf', import.meta.url))
  const font = await probe.embedFont(bytes, { subset: false, features: { calt: false, locl: false } })
  for (const line of lines) {
    const hex = font.encodeText(line).toString().slice(1, -1)
    let sum = 0
    for (let i = 0; i < hex.length; i += 4) {
      const g = parseInt(hex.slice(i, i + 4), 16)
      assert.ok(g !== 0, `글리프 없음(notdef): ${line}`)
      assert.ok(widths.has(g), `/W 누락 gid ${g}: ${line}`)
      sum += widths.get(g)
    }
    assert.ok(Math.abs(sum - font.widthOfTextAtSize(line, 1000)) < 0.5, `폭 불일치: ${line}`)
  }
})
