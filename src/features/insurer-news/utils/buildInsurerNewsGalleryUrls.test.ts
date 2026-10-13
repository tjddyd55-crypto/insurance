import { describe, expect, it } from 'vitest'
import { buildInsurerNewsGalleryUrls } from './buildInsurerNewsGalleryUrls'

describe('buildInsurerNewsGalleryUrls', () => {
  it('uses attachment openUrl for gallery img src', () => {
    const urls = buildInsurerNewsGalleryUrls({
      attachments: [
        {
          id: 'a1',
          kind: 'image',
          url: 'https://cdn.platform-assets.com/crm-platform/development/x.jpg',
          openUrl: '/api/insurer-news/n1/attachments/a1/open?accessToken=t',
          fileName: 'x.jpg',
          sortOrder: 0,
          objectKey: 'crm-platform/development/x.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    })
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/insurer-news/n1/attachments/a1/open')
  })
})
