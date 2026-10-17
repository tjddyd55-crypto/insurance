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
  displayName: 'QA 공개프로필',
  titleSuffix: 'FC',
  affiliationLine: '영진에셋 · 테스트팀',
  headline: '가족의 보장을 먼저 생각하는 설계사입니다.',
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
