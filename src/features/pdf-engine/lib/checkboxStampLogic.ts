/**
 * 체크박스 PDF 스탬프 — 값 판정·크기 계산 (클라이언트 미리보기, 서버 checkboxStampLogic.js 와 동일 계약).
 */

import type { PdfPlacement } from '../types'

export const CHECKBOX_MARK_GLYPH = '✓'
export const DEFAULT_CHECKBOX_STYLE = 'check'

export type CheckboxParsedValue = boolean | string | string[] | null

export function parseCheckboxFieldValue(rawValue: unknown): CheckboxParsedValue {
  if (rawValue == null) return null
  const str = String(rawValue).trim()
  if (!str) return null
  if (str === 'true') return true
  if (str === 'false') return false
  try {
    const parsed = JSON.parse(str) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
        .filter(Boolean)
    }
    if (typeof parsed === 'boolean') return parsed
    if (typeof parsed === 'string') return parsed.trim() || null
  } catch {
    /* plain string */
  }
  return str
}

export function placementCheckedValue(placement: Pick<PdfPlacement, 'checkedValue' | 'optionValue'>): string | null {
  const fromChecked = placement.checkedValue != null ? String(placement.checkedValue).trim() : ''
  if (fromChecked) return fromChecked
  const fromOption = placement.optionValue != null ? String(placement.optionValue).trim() : ''
  return fromOption || null
}

export function isCheckboxPlacementChecked(rawValue: unknown, placement: Pick<PdfPlacement, 'checkedValue' | 'optionValue'>): boolean {
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

const DEFAULT_BOX_PT = 11

export function checkboxMarkFontSizePt(placement: Pick<PdfPlacement, 'width' | 'height' | 'fontSize'>): number {
  const boxW = placement.width != null && placement.width > 0 ? placement.width : DEFAULT_BOX_PT
  const boxH = placement.height != null && placement.height > 0 ? placement.height : DEFAULT_BOX_PT
  const boxSize = Math.min(boxW, boxH)
  if (placement.fontSize != null && placement.fontSize > 0) return placement.fontSize
  return boxSize * 0.8
}
