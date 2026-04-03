const NOTE_MAX_LENGTH = 200

export function formatRrnInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13)
  if (d.length <= 6) {
    return d
  }
  return `${d.slice(0, 6)}-${d.slice(6)}`
}

/** 지시문 스펙: 1,2 → 1900년대, 3,4 → 2000년대, 그 외 코드는 계산 불가 */
export function calculateInsuranceInfo(rrn: string): { age: number | null; nextAgeDate: Date | null } {
  const clean = String(rrn ?? '').replace(/[^0-9]/g, '')

  if (clean.length < 7) {
    return { age: null, nextAgeDate: null }
  }

  const birth = clean.substring(0, 6)
  const genderCode = clean[6]

  let yearPrefix: string | null = null
  if (genderCode === '1' || genderCode === '2') {
    yearPrefix = '19'
  }
  if (genderCode === '3' || genderCode === '4') {
    yearPrefix = '20'
  }

  if (!yearPrefix) {
    return { age: null, nextAgeDate: null }
  }

  const year = Number(yearPrefix + birth.substring(0, 2))
  const month = Number(birth.substring(2, 4))
  const day = Number(birth.substring(4, 6))

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

  return {
    age: insuranceAge,
    nextAgeDate: thisYearUpperDate,
  }
}

export function formatInsuranceUiDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) {
    return '계산 불가'
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 날짜만(YYYY-MM-DD 또는 ISO) 표시 — 타임존 오프셋 피함 */
export function formatDateYmdInput(dateString: string | null): string {
  if (!dateString?.trim()) {
    return '-'
  }
  const s = dateString.trim()
  const dayPart = s.includes('T') ? s.slice(0, 10) : s
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dayPart)
  if (!m) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) {
      return '-'
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

export function nextAgeDateToIsoString(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) {
    return null
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export { NOTE_MAX_LENGTH }
