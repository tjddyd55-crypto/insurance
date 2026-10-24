import { clampNewsDetailViewerZoom } from '../../../components/news-detail-viewer/newsDetailViewerZoom'

/** 바인더 슬라이드 쇼 확대/축소 단위(10%). 버튼 등 모든 단계 입력이 이 값을 사용한다. 범위(min/max)는 공용 viewer 값 유지. */
export const BINDER_VIEWER_ZOOM_STEP = 0.1

/** 현재 배율에서 한 단계 확대(+1)/축소(-1). 부동소수 누적 오차 없이 10% 단위로 맞춘다. */
export function stepBinderViewerZoom(zoom: number, direction: 1 | -1): number {
  const next = Math.round((zoom + direction * BINDER_VIEWER_ZOOM_STEP) * 100) / 100
  return clampNewsDetailViewerZoom(next)
}

export function formatBinderViewerZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
