import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'

import { renderAdvisorMobileCardOgPng } from './renderAdvisorMobileCardOgImage.js'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'

const photo = await sharp({
  create: { width: 400, height: 500, channels: 3, background: '#94a3b8' },
})
  .png()
  .toBuffer()

test('renderAdvisorMobileCardOgPng is 1200x630 png (photo only, theme-agnostic)', async () => {
  const png = await renderAdvisorMobileCardOgPng({ photoBuffer: photo })
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
  assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
  assert.equal(meta.format, 'png')
})

test('renderAdvisorMobileCardOgPng uses fallback for corrupt tiny photo buffer', async () => {
  const corrupt = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  )
  const t0 = Date.now()
  const png = await renderAdvisorMobileCardOgPng({ photoBuffer: corrupt })
  assert.ok(Date.now() - t0 < 15_000)
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
  assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
})

test('renderAdvisorMobileCardOgPng renders without photo buffer', async () => {
  const png = await renderAdvisorMobileCardOgPng({ photoBuffer: null })
  const meta = await sharp(png).metadata()
  assert.equal(meta.format, 'png')
})

/**
 * @param {{ width: number, height: number, faceCx: number, faceCy: number, faceR: number }} spec
 */
async function photoWithFace(spec) {
  const svg = `<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#c5d4e4"/>
    <rect x="${Math.round(spec.width * 0.18)}" y="${spec.faceCy + spec.faceR}" width="${Math.round(spec.width * 0.64)}" height="${spec.height}" fill="#243044"/>
    <circle cx="${spec.faceCx}" cy="${spec.faceCy}" r="${spec.faceR}" fill="#e8b48a"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

function faceBounds(raw, width, height) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      const r = raw[i]
      const g = raw[i + 1]
      const b = raw[i + 2]
      if (r > 190 && g > 130 && g < 210 && b > 90 && b < 170 && r > g && g > b) {
        count += 1
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  return { count, minX, minY, maxX, maxY, boxW: maxX - minX, boxH: maxY - minY }
}

for (const spec of [
  { name: 'id-portrait', width: 480, height: 640, faceCx: 240, faceCy: 210, faceR: 90 },
  { name: 'upper-body', width: 600, height: 980, faceCx: 300, faceCy: 260, faceR: 110 },
  { name: 'landscape', width: 1280, height: 800, faceCx: 640, faceCy: 300, faceR: 120 },
]) {
  test(`renderAdvisorMobileCardOgPng keeps a large uncropped face (${spec.name})`, async () => {
    const png = await renderAdvisorMobileCardOgPng({ photoBuffer: await photoWithFace(spec) })
    const meta = await sharp(png).metadata()
    assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
    assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
    const raw = await sharp(png).removeAlpha().raw().toBuffer()
    const face = faceBounds(raw, meta.width, meta.height)
    assert.ok(face.count > 2500, `${spec.name} face pixels ${face.count}`)
    assert.ok(face.boxH > 160, `${spec.name} face height ${face.boxH}`)
    assert.ok(face.minY > 6, `${spec.name} face top ${face.minY}`)
    assert.ok(face.maxY < meta.height - 6, `${spec.name} face bottom ${face.maxY}`)
    assert.ok(face.minX > 40, `${spec.name} face left ${face.minX}`)
    assert.ok(face.maxX < meta.width - 40, `${spec.name} face right ${face.maxX}`)
  })
}
