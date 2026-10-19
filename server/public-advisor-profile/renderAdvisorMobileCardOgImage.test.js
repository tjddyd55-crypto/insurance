import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'

import { planAdvisorOgCardContain, renderAdvisorMobileCardOgPng } from './renderAdvisorMobileCardOgImage.js'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'

async function solidPng(width, height, color) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer()
}

function countColor(raw, width, height, match) {
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      if (match(raw[i], raw[i + 1], raw[i + 2])) count += 1
    }
  }
  return count
}

function colorBounds(raw, width, height, match) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      if (!match(raw[i], raw[i + 1], raw[i + 2])) continue
      count += 1
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { count, minX, minY, maxX, maxY, boxW: maxX - minX + 1, boxH: maxY - minY + 1 }
}

const isRed = (r, g, b) => r > 180 && g < 80 && b < 90
const isGreen = (r, g, b) => g > 140 && r < 80 && b < 90
const isMagenta = (r, g, b) => r > 200 && b > 140 && g < 80

test('planAdvisorOgCardContain keeps landscape and portrait aspect without cropping', () => {
  for (const spec of [
    { name: 'landscape', sw: 1800, sh: 1000 },
    { name: 'portrait', sw: 700, sh: 1200 },
    { name: 'wide-card', sw: 2000, sh: 700 },
  ]) {
    const plan = planAdvisorOgCardContain(spec.sw, spec.sh)
    assert.ok(plan.outWidth <= plan.maxWidth, spec.name)
    assert.ok(plan.outHeight <= plan.maxHeight, spec.name)
    assert.ok(plan.outWidth < ADVISOR_OG_IMAGE_WIDTH, `${spec.name} touches the side`)
    assert.ok(plan.outHeight < ADVISOR_OG_IMAGE_HEIGHT, `${spec.name} touches the edge`)
    const sourceAspect = spec.sw / spec.sh
    const outAspect = plan.outWidth / plan.outHeight
    assert.ok(Math.abs(sourceAspect - outAspect) < 0.03, `${spec.name} aspect ${outAspect} vs ${sourceAspect}`)
    const scaleW = plan.outWidth / spec.sw
    const scaleH = plan.outHeight / spec.sh
    assert.ok(Math.abs(scaleW - scaleH) < 0.02, `${spec.name} scales differ`)
  }

  const wide = planAdvisorOgCardContain(2000, 700)
  assert.ok(wide.outWidth / ADVISOR_OG_IMAGE_WIDTH >= 0.88, `wide width ratio ${wide.outWidth}`)
  assert.ok(wide.outWidth / ADVISOR_OG_IMAGE_WIDTH <= 0.94 + 0.005)

  const portrait = planAdvisorOgCardContain(700, 1200)
  assert.equal(portrait.outHeight, portrait.maxHeight)
  assert.ok(portrait.outWidth < portrait.outHeight)
})

test('renderAdvisorMobileCardOgPng contains a landscape card without cropping it', async () => {
  const png = await renderAdvisorMobileCardOgPng({ cardBuffer: await solidPng(1600, 900, '#e11d48') })
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
  assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
  const raw = await sharp(png).removeAlpha().raw().toBuffer()
  const box = colorBounds(raw, meta.width, meta.height, isRed)
  const plan = planAdvisorOgCardContain(1600, 900)
  assert.ok(box.count > 50_000)
  assert.ok(box.minX > 8 && box.minY > 8, `inset ${box.minX},${box.minY}`)
  assert.ok(box.maxX < meta.width - 8 && box.maxY < meta.height - 8)
  assert.ok(Math.abs(box.boxW - plan.outWidth) < 8, `width ${box.boxW} vs ${plan.outWidth}`)
  assert.ok(Math.abs(box.boxH - plan.outHeight) < 8, `height ${box.boxH} vs ${plan.outHeight}`)
  const corner = raw.slice(0, 3)
  assert.ok(corner[0] > 220 && corner[1] > 220 && corner[2] > 220, `corner ${corner}`)
})

test('renderAdvisorMobileCardOgPng contains a portrait card by height', async () => {
  const png = await renderAdvisorMobileCardOgPng({ cardBuffer: await solidPng(500, 900, '#e11d48') })
  const meta = await sharp(png).metadata()
  const raw = await sharp(png).removeAlpha().raw().toBuffer()
  const box = colorBounds(raw, meta.width, meta.height, isRed)
  const plan = planAdvisorOgCardContain(500, 900)
  assert.ok(box.boxH > box.boxW)
  assert.ok(Math.abs(box.boxW / box.boxH - 500 / 900) < 0.04)
  assert.ok(Math.abs(box.boxH - plan.outHeight) < 8)
  assert.ok(box.minY > 4 && box.maxY < meta.height - 4)
  assert.ok(box.minX > 40)
})

test('business card wins over a hero buffer, and a hero alone is not drawn', async () => {
  const card = await solidPng(900, 520, '#00b040')
  const hero = await solidPng(689, 886, '#ff2bd6')
  const withCard = await renderAdvisorMobileCardOgPng({ cardBuffer: card, photoBuffer: hero })
  const cardRaw = await sharp(withCard).removeAlpha().raw().toBuffer()
  const meta = await sharp(withCard).metadata()
  assert.ok(countColor(cardRaw, meta.width, meta.height, isGreen) > 50_000)
  assert.equal(countColor(cardRaw, meta.width, meta.height, isMagenta), 0)

  const heroOnly = await renderAdvisorMobileCardOgPng({ photoBuffer: hero })
  const heroRaw = await sharp(heroOnly).removeAlpha().raw().toBuffer()
  const heroMeta = await sharp(heroOnly).metadata()
  assert.equal(countColor(heroRaw, heroMeta.width, heroMeta.height, isMagenta), 0)
  assert.equal(heroMeta.width, ADVISOR_OG_IMAGE_WIDTH)
  assert.equal(heroMeta.height, ADVISOR_OG_IMAGE_HEIGHT)
})

test('missing or corrupt card renders the placeholder, not a thrown error', async () => {
  const missing = await renderAdvisorMobileCardOgPng({ cardBuffer: null })
  const corrupt = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  )
  const t0 = Date.now()
  const broken = await renderAdvisorMobileCardOgPng({ cardBuffer: corrupt })
  assert.ok(Date.now() - t0 < 15_000)
  for (const png of [missing, broken]) {
    const meta = await sharp(png).metadata()
    assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
    assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
    const raw = await sharp(png).removeAlpha().raw().toBuffer()
    const center = (Math.floor(meta.height / 2) * meta.width + Math.floor(meta.width / 2)) * 3
    assert.ok(raw[center] > 230 && raw[center + 1] > 230 && raw[center + 2] > 230)
  }
})

test('EXIF orientation is applied before the contain box', async () => {
  const wide = await sharp({
    create: { width: 640, height: 360, channels: 3, background: '#e11d48' },
  })
    .jpeg()
    .toBuffer()
  const turned = await sharp(wide).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const stored = await sharp(turned).metadata()
  assert.equal(stored.orientation, 6)
  assert.ok(stored.width > stored.height)
  const png = await renderAdvisorMobileCardOgPng({ cardBuffer: turned })
  const meta = await sharp(png).metadata()
  const raw = await sharp(png).removeAlpha().raw().toBuffer()
  const box = colorBounds(raw, meta.width, meta.height, isRed)
  assert.ok(box.boxH > box.boxW, `rendered ${box.boxW}x${box.boxH}`)
})
