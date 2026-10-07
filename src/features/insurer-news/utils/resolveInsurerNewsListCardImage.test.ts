import { describe, expect, it } from 'vitest'
import { resolveInsurerNewsListCardImageUrl } from './resolveInsurerNewsImageUrl'

const SSOT_OBJECT_KEY =
  'insurance/yjasset/shared/insurer-newsletters/acme/2026/06/1730000000000-photo.png'

describe('resolveInsurerNewsListCardImageUrl', () => {
  it('uses CDN for SSOT insurance/ objectKey (not same-origin relative path)', () => {
    const url = resolveInsurerNewsListCardImageUrl({
      heroImageObjectKey: SSOT_OBJECT_KEY,
      heroImageUrl: null,
      heroImageOpenUrl: null,
    })
    expect(url).toContain('cdn.platform-assets.com')
    expect(url).toContain('insurance/yjasset/shared/insurer-newsletters/acme')
    expect(url).not.toMatch(/\/\/insurance\/yjasset/)
  })

  it('prefers stored https heroImageUrl when objectKey is absent', () => {
    const url = resolveInsurerNewsListCardImageUrl({
      heroImageObjectKey: null,
      heroImageUrl: 'https://cdn.platform-assets.com/legacy/photo.png',
      heroImageOpenUrl: null,
    })
    expect(url).toContain('https://cdn.platform-assets.com/legacy/photo.png')
  })
})
