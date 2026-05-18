/**
 * stampPdf.js stampRadioCircleOutline 과 동일한 기하 비율(미리보기·좌표 편집기에서 재사용).
 * 좌표/값 저장 구조와 무관 — 화면 표시만 맞춘다.
 */

/** stampPdf 의 STAMP_RADIO_OUTLINE 과 동일 채널값 (rgb(0.937, 0.267, 0.267)) */
export const PDF_STAMP_RADIO_OUTLINE_CSS = 'rgb(239, 68, 68)'

/** stampPdf.js placement 폭·높이 폴백과 동일 (`DEFAULT_FONT_SIZE_PT` = 11) */
const DEFAULT_BOX_FALLBACK_PT = 11

/**
 * 라디오 원 지름 = min(boxW, boxH) × 0.8 (양수 폭·높이가 없으면 폴백).
 */
export function stampRadioDiameterFromBox(boxW: number, boxH: number): number {
  const w = Number.isFinite(boxW) && boxW > 0 ? boxW : DEFAULT_BOX_FALLBACK_PT
  const h = Number.isFinite(boxH) && boxH > 0 ? boxH : DEFAULT_BOX_FALLBACK_PT
  return Math.min(w, h) * 0.8
}

/** stampPdf: borderWidth = max(1, r * 0.12), r = 반경 */
export function stampRadioBorderWidthFromRadius(radius: number): number {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 4
  return Math.max(1, r * 0.12)
}
