/**
 * customers.gender DB SSOT: 'male' | 'female' | '' (미지정)
 */

/**
 * @param {unknown} raw
 * @returns {'male' | 'female' | null}
 */
export function normalizeCustomerGender(raw) {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (g === 'male' || g === 'm' || g === '남' || g === '남자' || g === '남성') {
    return 'male'
  }
  if (g === 'female' || g === 'f' || g === '여' || g === '여자' || g === '여성') {
    return 'female'
  }
  return null
}

/**
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
 * Excel·일괄등록: 명시 성별과 주민번호 추론이 모두 있으면 충돌 시 실패.
 * @param {unknown} genderRaw
 * @param {unknown} ssnRaw
 * @returns {{ ok: true, gender: '' | 'male' | 'female' } | { ok: false, code: 'invalid_gender' | 'gender_ssn_conflict' }}
 */
export function resolveCustomerGenderForImport(genderRaw, ssnRaw) {
  const raw = String(genderRaw ?? '').trim()
  const explicit = raw ? normalizeCustomerGender(raw) : null
  if (raw && !explicit) {
    return { ok: false, code: 'invalid_gender' }
  }
  const inferred = inferGenderFromResidentNumberDigits(ssnRaw)
  if (explicit && inferred && explicit !== inferred) {
    return { ok: false, code: 'gender_ssn_conflict' }
  }
  const gender = explicit ?? inferred ?? ''
  return { ok: true, gender }
}

/**
 * POST /customers 저장 경로 — 명시값(한글·영문) 우선, 없으면 주민번호 추론 (충돌 검사 없음, 기존 API 동작).
 * @param {unknown} genderRaw
 * @param {unknown} ssn
 * @returns {'' | 'male' | 'female'}
 */
export function resolveCustomerGenderForSave(genderRaw, ssn) {
  const explicit = normalizeCustomerGender(genderRaw)
  if (explicit) {
    return explicit
  }
  const trimmed = String(genderRaw ?? '').trim()
  if (trimmed === 'male' || trimmed === 'female') {
    return trimmed
  }
  return inferGenderFromResidentNumberDigits(ssn) ?? ''
}
