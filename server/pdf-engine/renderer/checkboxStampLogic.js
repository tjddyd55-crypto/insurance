/**
 * 체크박스 PDF 스탬프 — 값 판정·크기 계산 (서버/테스트 SSOT).
 */

import { DEFAULT_FONT_SIZE_PT } from './pdfTextLayout.js'

export const CHECKBOX_MARK_GLYPH = '✓'
export const DEFAULT_CHECKBOX_STYLE = 'check'

/**
 * @param {unknown} rawValue
 * @returns {boolean | string | string[] | null}
 */
export function parseCheckboxFieldValue(rawValue) {
  if (rawValue == null) return null
  const str = String(rawValue).trim()
  if (!str) return null
  if (str === 'true') return true
  if (str === 'false') return false
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === 'string' ? item.trim() : String(item))).filter(Boolean)
    }
    if (typeof parsed === 'boolean') return parsed
    if (typeof parsed === 'string') return parsed.trim() || null
  } catch {
    /* plain string */
  }
  return str
}

/**
 * placement.checkedValue 가 없으면 optionValue(레거시) 를 사용한다.
 *
 * @param {{ checkedValue?: string | null, optionValue?: string | null }} placement
 */
export function placementCheckedValue(placement) {
  const fromChecked =
    placement?.checkedValue != null ? String(placement.checkedValue).trim() : ''
  if (fromChecked) return fromChecked
  const fromOption = placement?.optionValue != null ? String(placement.optionValue).trim() : ''
  return fromOption || null
}

/**
 * @param {unknown} rawValue
 * @param {{ checkedValue?: string | null, optionValue?: string | null }} placement
 */
export function isCheckboxPlacementChecked(rawValue, placement) {
  const parsed = parseCheckboxFieldValue(rawValue)
  if (parsed === null || parsed === false) return false

  const checkedValue = placementCheckedValue(placement)

  if (parsed === true) {
    if (!checkedValue) return true
    return checkedValue === 'true'
  }

  if (!checkedValue) return false

  if (Array.isArray(parsed)) {
    return parsed.some((item) => String(item) === String(checkedValue))
  }

  return String(parsed) === String(checkedValue)
}

/**
 * @param {{ width?: number | null, height?: number | null, fontSize?: number | null }} placement
 */
export function checkboxMarkFontSizePt(placement) {
  const fallback = DEFAULT_FONT_SIZE_PT
  const boxW = placement?.width != null && placement.width > 0 ? placement.width : fallback
  const boxH = placement?.height != null && placement.height > 0 ? placement.height : fallback
  const boxSize = Math.min(boxW, boxH)
  if (placement?.fontSize != null && placement.fontSize > 0) return placement.fontSize
  return boxSize * 0.8
}
