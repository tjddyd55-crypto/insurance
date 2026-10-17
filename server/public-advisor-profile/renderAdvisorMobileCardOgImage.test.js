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

const baseInput = {
  heroDisplayEyebrow: 'ONE FC',
  heroDisplayTitle: '홍길동 FC',
  heroDisplaySubtitle: '영진에셋 · 팀장',
  heroDisplayEyebrowVisible: true,
  heroDisplayTitleVisible: true,
  heroDisplaySubtitleVisible: true,
  verificationBadgeLabel: '✓ ONE FC 확인',
  photoBuffer: photo,
}

for (const theme of ['classic', 'brand', 'premium']) {
  test(`renderAdvisorMobileCardOgPng ${theme} is 1200x630 png`, async () => {
    const png = await renderAdvisorMobileCardOgPng({ ...baseInput, theme })
    const meta = await sharp(png).metadata()
    assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
    assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
    assert.equal(meta.format, 'png')
  })
}

test('renderAdvisorMobileCardOgPng uses fallback for corrupt tiny photo buffer', async () => {
  const corrupt = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  )
  const t0 = Date.now()
  const png = await renderAdvisorMobileCardOgPng({ ...baseInput, theme: 'classic', photoBuffer: corrupt })
  assert.ok(Date.now() - t0 < 15_000)
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, ADVISOR_OG_IMAGE_WIDTH)
  assert.equal(meta.height, ADVISOR_OG_IMAGE_HEIGHT)
})

test('renderAdvisorMobileCardOgPng renders without photo buffer', async () => {
  const png = await renderAdvisorMobileCardOgPng({ ...baseInput, theme: 'brand', photoBuffer: null })
  const meta = await sharp(png).metadata()
  assert.equal(meta.format, 'png')
})
