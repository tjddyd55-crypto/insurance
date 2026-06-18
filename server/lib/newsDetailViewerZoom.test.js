import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  NEWS_DETAIL_VIEWER_ZOOM_MAX,
  NEWS_DETAIL_VIEWER_ZOOM_MIN,
  clampNewsDetailViewerZoom,
  getTouchDistance,
} from '../../src/components/news-detail-viewer/newsDetailViewerZoom.ts'

describe('news detail viewer zoom', () => {
  it('clamps zoom to configured range', () => {
    assert.equal(clampNewsDetailViewerZoom(0.1), NEWS_DETAIL_VIEWER_ZOOM_MIN)
    assert.equal(clampNewsDetailViewerZoom(5), NEWS_DETAIL_VIEWER_ZOOM_MAX)
    assert.equal(clampNewsDetailViewerZoom(1.5), 1.5)
    assert.equal(clampNewsDetailViewerZoom(Number.NaN), 1)
  })

  it('computes pinch distance between two touches', () => {
    const touches = [
      { clientX: 0, clientY: 0 },
      { clientX: 3, clientY: 4 },
    ]
    assert.equal(getTouchDistance(touches), 5)
    assert.equal(getTouchDistance([touches[0]]), 0)
  })
})
