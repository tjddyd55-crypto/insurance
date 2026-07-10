import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const modalPath = path.join(process.cwd(), 'src/components/news-detail-viewer/NewsDetailViewerModal.tsx')
const zoomPath = path.join(process.cwd(), 'src/components/news-detail-viewer/NewsDetailZoomContent.tsx')
const cssPath = path.join(process.cwd(), 'src/components/news-detail-viewer/news-detail-viewer.css')
const insurerPcPath = path.join(
  process.cwd(),
  'src/features/insurer-news/pages/InsurerManagerNewsList/InsurerManagerNewsListPCView.tsx',
)
const customerNewsPath = path.join(process.cwd(), 'src/features/customer-app/pages/CustomerAppNewsListPage.tsx')

describe('news detail viewer modal', () => {
  it('does not close on backdrop click', () => {
    const src = fs.readFileSync(modalPath, 'utf8')
    assert.match(src, /news-detail-viewer-backdrop/)
    assert.doesNotMatch(src, /news-detail-viewer-backdrop[\s\S]*onClick=\{onClose\}/)
    assert.doesNotMatch(src, /onClick=\{closeDetailModal\}/)
    assert.match(src, /useBodyScrollLock/)
  })

  it('uses width-based zoom instead of transform scale', () => {
    const zoomSrc = fs.readFileSync(zoomPath, 'utf8')
    assert.equal(zoomSrc.includes('transform:'), false)
    assert.equal(zoomSrc.includes('scale('), false)
    assert.match(zoomSrc, /--news-zoom/)
  })

  it('keeps a single scroll container in CSS', () => {
    const css = fs.readFileSync(cssPath, 'utf8')
    assert.match(css, /\.news-detail-viewer-scroll[\s\S]*overflow:\s*auto/)
    assert.match(css, /\.news-detail-viewer-panel[\s\S]*overflow:\s*hidden/)
    assert.match(css, /\.news-detail-viewer-backdrop[\s\S]*overflow:\s*hidden/)
    assert.match(css, /\.news-detail-viewer-panel[\s\S]*height:\s*90vh/)
    assert.doesNotMatch(css, /\.news-detail-viewer-panel[\s\S]*height:\s*auto/)
    assert.doesNotMatch(css, /\.news-detail-viewer-panel[\s\S]*fit-content/)
  })

  it('is adopted by insurer and customer news list views', () => {
    const insurerSrc = fs.readFileSync(insurerPcPath, 'utf8')
    const customerSrc = fs.readFileSync(customerNewsPath, 'utf8')
    assert.match(insurerSrc, /NewsDetailViewerModal/)
    assert.match(customerSrc, /NewsDetailViewerModal/)
    assert.match(insurerSrc, /onZoomChange/)
    assert.match(customerSrc, /onZoomChange/)
    assert.equal(insurerSrc.includes('className="news-modal"'), false)
    assert.equal(customerSrc.includes('className="customer-news-modal"'), false)
  })

  it('supports mobile pinch zoom via non-passive touch listener', () => {
    const modalSrc = fs.readFileSync(modalPath, 'utf8')
    assert.match(modalSrc, /useNewsDetailViewerPinchZoom/)
    const hookSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/news-detail-viewer/useNewsDetailViewerPinchZoom.ts'),
      'utf8',
    )
    assert.match(hookSrc, /passive:\s*false/)
    assert.match(hookSrc, /event\.touches\.length !== 2/)
    assert.match(hookSrc, /detachPinchMove/)
    assert.match(hookSrc, /getTouchDistance/)
  })

  it('applies pinch zoom to mobile route detail pages', () => {
    const mobileScrollPath = path.join(process.cwd(), 'src/components/news-detail-viewer/NewsDetailMobileZoomScroll.tsx')
    const mobileScrollSrc = fs.readFileSync(mobileScrollPath, 'utf8')
    assert.match(mobileScrollSrc, /useNewsDetailViewerPinchZoom/)
    assert.match(mobileScrollSrc, /useNewsDetailViewerPan/)
    assert.match(mobileScrollSrc, /news-detail-mobile-scroll--zoomed/)
    assert.match(mobileScrollSrc, /NewsDetailZoomContent/)

    const insurerDetailPath = path.join(
      process.cwd(),
      'src/features/insurer-news/pages/InsurerManagerNewsDetailPage.tsx',
    )
    const boardWriterDetailPath = path.join(
      process.cwd(),
      'src/features/insurer-news/pages/BoardWriterNewsDetailPage.tsx',
    )
    const customerDetailPath = path.join(process.cwd(), 'src/features/customer-app/pages/CustomerAppNewsDetailPage.tsx')
    const boardDetailPath = path.join(
      process.cwd(),
      'src/features/insurer-news/pages/DynamicNewsletterBoardDetailPage.tsx',
    )

    assert.match(fs.readFileSync(insurerDetailPath, 'utf8'), /NewsDetailViewerModal/)
    assert.match(fs.readFileSync(boardWriterDetailPath, 'utf8'), /NewsDetailViewerModal/)
    assert.match(fs.readFileSync(customerDetailPath, 'utf8'), /NewsDetailMobileZoomScroll/)
    assert.match(fs.readFileSync(boardDetailPath, 'utf8'), /NewsDetailViewerModal/)

    const css = fs.readFileSync(cssPath, 'utf8')
    assert.match(css, /\.news-detail-mobile-scroll--zoomed[\s\S]*overflow:\s*auto/)
    assert.match(css, /\.news-detail-mobile-scroll--zoomed[\s\S]*touch-action:\s*none/)
    assert.match(css, /\.news-detail-viewer-scroll--zoomed[\s\S]*touch-action:\s*none/)
  })

  it('mounts link previews in shared insurer news viewer content', () => {
    const contentPath = path.join(
      process.cwd(),
      'src/features/insurer-news/components/InsurerNewsDetailViewerContent.tsx',
    )
    const contentSrc = fs.readFileSync(contentPath, 'utf8')
    assert.match(contentSrc, /AutoLinkText/)
    assert.match(contentSrc, /LinkPreviewCard/)
    assert.match(contentSrc, /enableAutoLinking/)
    assert.match(contentSrc, /enablePhoneLinks/)

    const insurerPcPath = path.join(
      process.cwd(),
      'src/features/insurer-news/pages/InsurerManagerNewsList/InsurerManagerNewsListPCView.tsx',
    )
    const insurerPcSrc = fs.readFileSync(insurerPcPath, 'utf8')
    assert.match(insurerPcSrc, /InsurerNewsDetailViewerContent/)
    assert.doesNotMatch(insurerPcSrc, /<AutoLinkText/)
  })

  it('enables diagonal pan while zoomed via pointer scroll updates', () => {
    const panPath = path.join(process.cwd(), 'src/components/news-detail-viewer/useNewsDetailViewerPan.ts')
    const panSrc = fs.readFileSync(panPath, 'utf8')
    assert.match(panSrc, /scrollLeft -= dx/)
    assert.match(panSrc, /scrollTop -= dy/)
    assert.doesNotMatch(panSrc, /Math\.abs\(dx\)/)
    assert.doesNotMatch(panSrc, /Math\.abs\(dy\)/)

    const modalSrc = fs.readFileSync(modalPath, 'utf8')
    assert.match(modalSrc, /useNewsDetailViewerPan/)
    assert.match(modalSrc, /news-detail-viewer-scroll--zoomed/)
  })
})
