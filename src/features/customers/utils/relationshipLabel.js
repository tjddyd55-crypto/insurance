/**
 * 연계 고객 관계 라벨 — preset / 기타 직접입력 공통 규칙.
 * 저장은 relationship_label 문자열. enum 컬럼 없음.
 */

export const RELATIONSHIP_LABEL_ETC = '기타'
export const RELATIONSHIP_LABEL_SELF = '본인'
export const RELATIONSHIP_LABEL_MAX_LENGTH = 30

/** @type {readonly string[]} */
export const RELATIONSHIP_LABEL_PRESETS = Object.freeze([
  RELATIONSHIP_LABEL_SELF,
  '배우자',
  '아버지',
  '어머니',
  '자녀',
  '형제',
  RELATIONSHIP_LABEL_ETC,
])

/** FormSelect 표시용 — value 는 저장값, label 은 UI */
export const RELATIONSHIP_LABEL_SELECT_OPTIONS = [
  { value: '배우자', label: '배우자' },
  { value: '아버지', label: '아버지' },
  { value: '어머니', label: '어머니' },
  { value: '자녀', label: '자녀' },
  { value: '형제', label: '형제·자매' },
  { value: RELATIONSHIP_LABEL_ETC, label: RELATIONSHIP_LABEL_ETC },
]

export const RELATIONSHIP_LABEL_EDIT_SELECT_OPTIONS = [
  { value: RELATIONSHIP_LABEL_SELF, label: RELATIONSHIP_LABEL_SELF },
  ...RELATIONSHIP_LABEL_SELECT_OPTIONS,
]

/**
 * 선택 option + 기타 직접입력을 저장용 relationshipLabel 로 변환.
 * 빈 값 / 기타만 입력 → null (차단).
 * @param {string} option
 * @param {string} customRaw
 * @returns {string | null}
 */
export function resolveRelationshipLabel(option, customRaw) {
  const opt = String(option ?? '').trim()
  if (!opt) return null
  if (opt === RELATIONSHIP_LABEL_ETC) {
    const custom = String(customRaw ?? '').trim()
    if (!custom) return null
    return custom.slice(0, RELATIONSHIP_LABEL_MAX_LENGTH)
  }
  return opt
}

/**
 * 저장된 label 을 select option + custom 필드로 분해.
 * preset 이 아니면 option=기타, custom=원문.
 * @param {string} label
 * @returns {{ option: string, custom: string }}
 */
export function splitRelationshipLabelForEdit(label) {
  const trimmed = String(label ?? '').trim()
  if (!trimmed) {
    return { option: '배우자', custom: '' }
  }
  if (RELATIONSHIP_LABEL_PRESETS.includes(trimmed) && trimmed !== RELATIONSHIP_LABEL_ETC) {
    return { option: trimmed, custom: '' }
  }
  if (trimmed === RELATIONSHIP_LABEL_ETC) {
    return { option: RELATIONSHIP_LABEL_ETC, custom: '' }
  }
  return {
    option: RELATIONSHIP_LABEL_ETC,
    custom: trimmed.slice(0, RELATIONSHIP_LABEL_MAX_LENGTH),
  }
}

/**
 * @param {string} option
 */
export function isEtcRelationshipOption(option) {
  return String(option ?? '').trim() === RELATIONSHIP_LABEL_ETC
}
