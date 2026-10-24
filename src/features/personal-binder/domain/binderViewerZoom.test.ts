import { describe, expect, it } from 'vitest'
import {
  NEWS_DETAIL_VIEWER_ZOOM_MAX,
  NEWS_DETAIL_VIEWER_ZOOM_MIN,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import { BINDER_VIEWER_ZOOM_STEP, formatBinderViewerZoomPercent, stepBinderViewerZoom } from './binderViewerZoom'

describe('binderViewerZoom', () => {
  it('10% 단위로 확대/축소한다', () => {
    expect(BINDER_VIEWER_ZOOM_STEP).toBe(0.1)
    const up: string[] = []
    let z = 1
    for (let i = 0; i < 3; i++) up.push(formatBinderViewerZoomPercent((z = stepBinderViewerZoom(z, 1))))
    expect(up).toEqual(['110%', '120%', '130%'])
    const down: string[] = []
    for (let i = 0; i < 4; i++) down.push(formatBinderViewerZoomPercent((z = stepBinderViewerZoom(z, -1))))
    expect(down).toEqual(['120%', '110%', '100%', '90%'])
    expect(z).toBe(0.9)
  })
  it('기존 min/max 범위를 유지한다', () => {
    expect(stepBinderViewerZoom(NEWS_DETAIL_VIEWER_ZOOM_MIN, -1)).toBe(NEWS_DETAIL_VIEWER_ZOOM_MIN)
    expect(stepBinderViewerZoom(NEWS_DETAIL_VIEWER_ZOOM_MAX, 1)).toBe(NEWS_DETAIL_VIEWER_ZOOM_MAX)
  })
})
