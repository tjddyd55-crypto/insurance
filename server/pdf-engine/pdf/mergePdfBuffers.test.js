import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'

import { assertPdfBufferHeader, mergePdfUploadBuffers } from './mergePdfBuffers.js'

async function makePdf(pageCount) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([400, 500])
  }
  return Buffer.from(await doc.save())
}

test('mergePdfUploadBuffers: single PDF unchanged page count', async () => {
  const buf = await makePdf(2)
  const out = await mergePdfUploadBuffers([{ buffer: buf, fileName: 'one.pdf' }])
  assert.equal(out.pageCount, 2)
  assert.equal(out.sourcePdfMetadata.length, 1)
  assert.equal(out.sourcePdfMetadata[0].fileName, 'one.pdf')
  const reload = await PDFDocument.load(out.mergedBuffer)
  assert.equal(reload.getPageCount(), 2)
})

test('mergePdfUploadBuffers: 1-page + 2-page => 3 pages in order', async () => {
  const a = await makePdf(1)
  const b = await makePdf(2)
  const out = await mergePdfUploadBuffers([
    { buffer: a, fileName: 'a.pdf' },
    { buffer: b, fileName: 'b.pdf' },
  ])
  assert.equal(out.pageCount, 3)
  assert.deepEqual(out.sourcePdfMetadata, [
    { fileName: 'a.pdf', startPage: 1, endPage: 1, pageCount: 1 },
    { fileName: 'b.pdf', startPage: 2, endPage: 3, pageCount: 2 },
  ])
  const reload = await PDFDocument.load(out.mergedBuffer)
  assert.equal(reload.getPageCount(), 3)
})

test('mergePdfUploadBuffers: corrupted PDF fails with index message', async () => {
  await assert.rejects(
    () => mergePdfUploadBuffers([{ buffer: Buffer.from('not-a-pdf'), fileName: 'bad.pdf' }]),
    /PDF 파일만 업로드할 수 있습니다/,
  )
  const one = await makePdf(1)
  await assert.rejects(
    () =>
      mergePdfUploadBuffers([
        { buffer: one, fileName: 'ok.pdf' },
        { buffer: Buffer.from('%PDF-broken'), fileName: 'bad.pdf' },
      ]),
    /2번째 파일을 읽을 수 없습니다/,
  )
})

test('assertPdfBufferHeader: rejects non-PDF', () => {
  assert.throws(() => assertPdfBufferHeader(Buffer.from('hello')), /PDF 파일만/)
})
