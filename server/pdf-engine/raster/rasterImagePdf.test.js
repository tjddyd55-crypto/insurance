import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

import {
  buildRasterImagesPdfBuffer,
  getRasterPdfPageLayout,
  normalizeRasterForPdf,
} from './rasterImagePdf.js'

async function image(width, height, format = 'jpeg') {
  const pipeline = sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
  return format === 'png' ? pipeline.png().toBuffer() : pipeline.jpeg().toBuffer()
}

test('raster page layout uses portrait and landscape deterministically', () => {
  assert.equal(getRasterPdfPageLayout(800, 1200), 'portrait')
  assert.equal(getRasterPdfPageLayout(1200, 800), 'landscape')
})

test('normalizeRasterForPdf applies EXIF orientation', async () => {
  const raw = await image(1200, 800)
  const rotated = await sharp(raw).withMetadata({ orientation: 6 }).toBuffer()
  const normalized = await normalizeRasterForPdf(rotated, 'image/jpeg')
  assert.ok(normalized.height > normalized.width)
})

test('buildRasterImagesPdfBuffer preserves input order and page orientation', async () => {
  const portrait = await image(800, 1200)
  const landscape = await image(1200, 800, 'png')
  const bytes = await buildRasterImagesPdfBuffer([
    { fileName: 'portrait.jpg', mime: 'image/jpeg', bytes: portrait },
    { fileName: 'landscape.png', mime: 'image/png', bytes: landscape },
  ])
  const document = await PDFDocument.load(bytes)
  assert.equal(document.getPageCount(), 2)
  const first = document.getPage(0).getSize()
  const second = document.getPage(1).getSize()
  assert.ok(first.height > first.width)
  assert.ok(second.width > second.height)
})

test('buildRasterImagesPdfBuffer fails atomically for a corrupt image', async () => {
  await assert.rejects(
    buildRasterImagesPdfBuffer([
      { fileName: 'broken.jpg', mime: 'image/jpeg', bytes: Buffer.from('not-an-image') },
    ]),
    /broken\.jpg/,
  )
})
