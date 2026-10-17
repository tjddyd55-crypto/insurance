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
