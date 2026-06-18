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
    assert.equal(insurerSrc.includes('className="news-modal"'), false)
    assert.equal(customerSrc.includes('className="customer-news-modal"'), false)
  })
})
