import { formatLocalYmd, parseBirthDateFromRrn } from './insuranceAge'

const RRN_NORMALIZED_LENGTH = 13

function normalizeSsnDigits(ssn: string): string {
  return String(ssn ?? '')
    .replace(/\D/g, '')
    .trim()
}

export type CustomerExcelBirthRrnResolveResult =
  | { ok: true }
  | { ok: false; code: 'birth_ssn_conflict' }

/** 생년월일·주민번호가 모두 있을 때 날짜 일치 검증 */
export function resolveBirthDateVsRrnConflict(
  birthDateYmd: string,
  ssnRaw: string,
): CustomerExcelBirthRrnResolveResult {
  const birth = String(birthDateYmd ?? '').trim()
  const ssn = normalizeSsnDigits(ssnRaw)
  if (!birth || ssn.length !== RRN_NORMALIZED_LENGTH) {
    return { ok: true }
  }
  const fromRrn = parseBirthDateFromRrn(ssn)
  if (!fromRrn) {
    return { ok: true }
  }
  const rrnYmd = formatLocalYmd(fromRrn)
  if (rrnYmd === birth) {
    return { ok: true }
  }
  return { ok: false, code: 'birth_ssn_conflict' }
}

export function customerExcelBirthRrnErrorMessage(code: 'birth_ssn_conflict'): string {
  if (code === 'birth_ssn_conflict') {
    return '생년월일과 주민등록번호의 생년월일이 일치하지 않습니다.'
  }
  return '생년월일을 확인해 주세요.'
}
