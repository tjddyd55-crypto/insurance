/**
 * 한국 주민등록번호(또는 외국인 등록번호) — 숫자만 모았을 때 7번째 자리 성별 코드.
 * 1, 3, 5, 7, 9 → male / 2, 4, 6, 8, 0 → female (프론트 inferGenderFromResidentNumberDigits 와 동일).
 *
 * @param {unknown} raw
 * @returns {'male' | 'female' | null}
 */
export function inferGenderFromResidentNumberDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 7) {
    return null
  }
  const code = digits[6]
  if (/[13579]/.test(code)) {
    return 'male'
  }
  if (/[24680]/.test(code)) {
    return 'female'
  }
  return null
}

/**
 * 저장용 gender normalize. 명시된 male/female 은 유지, 비어 있으면 주민번호로 추론.
 *
 * @param {unknown} genderRaw
 * @param {unknown} ssn
 * @returns {'' | 'male' | 'female'}
 */
export function resolveCustomerGenderForSave(genderRaw, ssn) {
  const trimmed = String(genderRaw ?? '').trim()
  if (trimmed === 'male' || trimmed === 'female') {
    return trimmed
  }
  return inferGenderFromResidentNumberDigits(ssn) ?? ''
}
