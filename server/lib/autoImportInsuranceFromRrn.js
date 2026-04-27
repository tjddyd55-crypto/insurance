/**
 * 고객 자동 import 전용 — `server/index.js` 의 RRN 보험나이 계산과 동일 알고리즘.
 * (index.js 수정 범위를 줄이기 위해 복사 유지)
 */

export function calculateInsuranceInfoFromRrn(rrnRaw) {
  const clean = String(rrnRaw ?? '').replace(/[^0-9]/g, '')
  if (clean.length < 7) {
    return { age: null, nextAgeDate: null }
  }
  const birth = clean.substring(0, 6)
  const genderCode = clean[6]
  let yearPrefix = null
  if (genderCode === '1' || genderCode === '2') {
    yearPrefix = '19'
  }
  if (genderCode === '3' || genderCode === '4') {
    yearPrefix = '20'
  }
  if (!yearPrefix) {
    return { age: null, nextAgeDate: null }
  }
  const year = parseInt(yearPrefix + birth.substring(0, 2), 10)
  const month = parseInt(birth.substring(2, 4), 10)
  const day = parseInt(birth.substring(4, 6), 10)
  const birthDate = new Date(year, month - 1, day)
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return { age: null, nextAgeDate: null }
  }
  const today = new Date()
  let insuranceAge = today.getFullYear() - year
  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day)
  const thisYearUpperDate = new Date(thisYearBirthday)
  thisYearUpperDate.setMonth(thisYearUpperDate.getMonth() + 6)
  if (today >= thisYearUpperDate) {
    insuranceAge += 1
  }
  return { age: insuranceAge, nextAgeDate: thisYearUpperDate }
}

export function nextAgeDateToSqlDate(d) {
  if (!d || Number.isNaN(d.getTime())) {
    return null
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
