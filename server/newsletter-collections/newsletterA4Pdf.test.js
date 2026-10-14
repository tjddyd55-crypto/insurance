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
