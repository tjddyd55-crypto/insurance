import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

import { binderPageImageCacheKey, createBinderPageImageCache } from './binderPageImageCache.js'
import { readBinderPageImageToken, issueBinderPageImageToken } from './binderPageImageToken.js'
import { listBinderViewerPages } from './binderViewerPages.js'
import { resolveBinderPageImageWidth } from './binderPageImageWidth.js'
import { renderBinderPageImage } from './renderBinderPageImage.js'

async function twoPagePdf() {
  const doc = await PDFDocument.create()
  const first = doc.addPage([200, 100])
  first.drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(1, 0, 0) })
  const second = doc.addPage([200, 100])
  second.drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(0, 0, 1) })
  return Buffer.from(await doc.save())
}

test('binder page image width snaps to thumbnail and full buckets', () => {
  assert.equal(resolveBinderPageImageWidth({}), 1080)
  assert.equal(resolveBinderPageImageWidth({ preset: 'thumb' }), 240)
  assert.equal(resolveBinderPageImageWidth({ preset: 'full' }), 1080)
  assert.equal(resolveBinderPageImageWidth({ width: 100 }), 240)
  assert.equal(resolveBinderPageImageWidth({ width: 1000 }), 1080)
  assert.equal(resolveBinderPageImageWidth({ width: 9999 }), 1600)
  assert.equal(resolveBinderPageImageWidth({ width: 200, preset: 'thumb' }), 240)
  assert.throws(() => resolveBinderPageImageWidth({ width: 'wide' }), /width는 숫자/)
  assert.throws(() => resolveBinderPageImageWidth({ preset: 'print' }), /preset은 thumb/)
})

test('binder viewer pages follow section, item, and page selection order', () => {
  const pages = listBinderViewerPages({
    sections: [
      {
        id: '2',
        title: '나중',
        sortOrder: 1,
        items: [
          {
            id: '9',
            materialId: '4',
            sortOrder: 0,
            pageSelection: [2],
            material: { fileId: 40, mimeType: 'application/pdf', pageCount: 3 },
          },
        ],
      },
      {
        id: '1',
        title: '먼저',
        sortOrder: 0,
        items: [
          {
            id: '8',
            materialId: '3',
            sortOrder: 0,
            pageSelection: null,
            material: { fileId: 30, mimeType: 'image/png', pageCount: 1 },
          },
        ],
      },
    ],
  })
  assert.deepEqual(pages.map((page) => [page.index, page.sectionTitle, page.pdfPageNumber, page.kind]), [
    [1, '먼저', 1, 'image'],
    [2, '나중', 2, 'pdf'],
  ])
})

test('binder page image token rejects a different secret and a tampered width', () => {
  const token = issueBinderPageImageToken('secret-a', {
    userId: 'user-a',
    gaId: 1,
    materialId: 3,
    fileId: 4,
    page: 2,
    width: 240,
  })
  const read = readBinderPageImageToken('secret-a', token)
  assert.equal(read.ok, true)
  assert.equal(read.claims.page, 2)
  assert.equal(read.claims.width, 240)
  assert.equal(readBinderPageImageToken('secret-b', token).ok, false)
  const [header, payload, signature] = token.split('.')
  const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  body.width = 999
  const forgedPayload = Buffer.from(JSON.stringify(body)).toString('base64url')
  assert.equal(readBinderPageImageToken('secret-a', `${header}.${forgedPayload}.${signature}`).ok, false)
})

test('binder page image cache renders each file page width once', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'binder-page-cache-'))
  try {
    const cache = createBinderPageImageCache(root)
    const key = binderPageImageCacheKey({ fileId: 4, fingerprint: 'abcd1234abcd1234', page: 1, width: 240 })
    let calls = 0
    const first = await cache.getOrCreate(key, async () => {
      calls += 1
      return { buffer: Buffer.from('jpeg-a'), contentType: 'image/jpeg', pixelWidth: 240, pixelHeight: 120 }
    })
    const second = await cache.getOrCreate(key, async () => {
      calls += 1
      return { buffer: Buffer.from('jpeg-b'), contentType: 'image/jpeg', pixelWidth: 1, pixelHeight: 1 }
    })
    assert.equal(calls, 1)
    assert.equal(first.cache, 'miss')
    assert.equal(second.cache, 'hit')
    assert.equal(second.buffer.toString(), 'jpeg-a')
    assert.equal(second.pixelWidth, 240)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('pdf and image materials render to jpeg at the requested width', async () => {
  const pdf = await twoPagePdf()
  const first = await renderBinderPageImage({ buffer: pdf, mimeType: 'application/pdf', page: 1, width: 240 })
  const second = await renderBinderPageImage({ buffer: pdf, mimeType: 'application/pdf', page: 2, width: 240 })
  assert.equal(first.buffer[0], 0xff)
  assert.equal(first.buffer[1], 0xd8)
  assert.equal(first.pixelWidth, 240)
  assert.equal(first.pixelHeight, 120)
  const firstMean = (await sharp(first.buffer).stats()).channels.map((channel) => Math.round(channel.mean))
  const secondMean = (await sharp(second.buffer).stats()).channels.map((channel) => Math.round(channel.mean))
  assert.ok(firstMean[0] > 200 && firstMean[2] < 40)
  assert.ok(secondMean[2] > 200 && secondMean[0] < 40)
  await assert.rejects(
    () => renderBinderPageImage({ buffer: pdf, mimeType: 'application/pdf', page: 3, width: 240 }),
    /페이지 범위/,
  )

  const png = await sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 0, g: 180, b: 0 } },
  }).png().toBuffer()
  const image = await renderBinderPageImage({ buffer: png, mimeType: 'image/png', page: 1, width: 240 })
  assert.equal(image.pixelWidth, 240)
  assert.equal(image.pixelHeight, 120)
  assert.equal(image.contentType, 'image/jpeg')
})
