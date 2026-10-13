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

  it('prefers heroImageOpenUrl over CDN objectKey (DEV bucket vs prod CDN)', () => {
    const url = resolveInsurerNewsListCardImageUrl({
      heroImageObjectKey: 'crm-platform/development/insurance/tenants/yjasset/photo.jpg',
      heroImageUrl: 'https://cdn.platform-assets.com/crm-platform/development/insurance/tenants/yjasset/photo.jpg',
      heroImageOpenUrl: '/api/insurer-news/n1/attachments/a1/open?accessToken=abc',
    })
    expect(url).toContain('/insurer-news/n1/attachments/a1/open')
    expect(url).not.toContain('cdn.platform-assets.com')
  })
})
