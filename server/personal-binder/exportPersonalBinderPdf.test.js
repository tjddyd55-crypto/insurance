import assert from 'node:assert/strict'
import test from 'node:test'

import { PDFDocument } from 'pdf-lib'

import {
  assembleBinderPdf,
  planBinderExport,
  resolveItemPages,
} from './exportPersonalBinderPdf.js'

async function pdfWithSizes(sizes) {
  const doc = await PDFDocument.create()
  for (const [width, height] of sizes) {
    doc.addPage([width, height])
  }
  return Buffer.from(await doc.save())
}

test('binder export keeps section, item, and pageSelection order', () => {
  const jobs = planBinderExport({
    sections: [
      {
        sortOrder: 1,
        items: [
          {
            materialId: 'b',
            sortOrder: 0,
            pageSelection: [2],
            material: { pageCount: 4 },
          },
        ],
      },
      {
        sortOrder: 0,
        items: [
          {
            materialId: 'a',
            sortOrder: 1,
            pageSelection: null,
            material: { pageCount: 2 },
          },
          {
            materialId: 'a',
            sortOrder: 0,
            pageSelection: [3, 1],
            material: { pageCount: 5 },
          },
        ],
      },
    ],
  })
  assert.deepEqual(jobs, [
    { materialId: 'a', pages: [3, 1] },
    { materialId: 'a', pages: [1, 2] },
    { materialId: 'b', pages: [2] },
  ])
})

test('binder export rejects empty and out-of-range selections', () => {
  assert.deepEqual(resolveItemPages(null, 3), [1, 2, 3])
  assert.throws(() => resolveItemPages([], 3), /페이지 선택/)
  assert.throws(() => resolveItemPages([0, 2], 3), /범위/)
  assert.throws(() => planBinderExport({ sections: [] }), /내보낼 상담 페이지/)
})

test('binder export copies original pages without blanks or reordering', async () => {
  const first = await pdfWithSizes([
    [595, 842],
    [400, 400],
    [320, 480],
  ])
  const second = await pdfWithSizes([[842, 595]])
  const merged = await assembleBinderPdf([
    { buffer: first, pages: [3, 1] },
    { buffer: second, pages: [1] },
  ])
  const reloaded = await PDFDocument.load(merged)
  assert.equal(reloaded.getPageCount(), 3)
  assert.deepEqual(
    [0, 1, 2].map((index) => {
      const size = reloaded.getPage(index).getSize()
      return [Math.round(size.width), Math.round(size.height)]
    }),
    [
      [320, 480],
      [595, 842],
      [842, 595],
    ],
  )
})
