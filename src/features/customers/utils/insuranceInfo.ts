const NOTE_MAX_LENGTH = 200

export function formatRrnInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13)
  if (d.length <= 6) {
    return d
  }
  return `${d.slice(0, 6)}-${d.slice(6)}`
}

export function calculateInsuranceInfo(rrn: string): { age: number | null; nextAgeDate: Date | null } {
  const digits = String(rrn ?? '').replace(/\D/g, '')
  if (digits.length < 7) {
    return { age: null, nextAgeDate: null }
  }

  const birth = digits.substring(0, 6)
  const genderCode = digits[6]

  let yearPrefix = '19'
  if (genderCode === '3' || genderCode === '4') {
    yearPrefix = '20'
  }

  const year = parseInt(yearPrefix + birth.substring(0, 2), 10)
  const month = parseInt(birth.substring(2, 4), 10)
  const day = parseInt(birth.substring(4, 6), 10)

  const birthDate = new Date(year, month - 1, day)
  if (Number.isNaN(birthDate.getTime())) {
    return { age: null, nextAgeDate: null }
  }

  const today = new Date()
  let age = today.getFullYear() - year

  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day)
  const nextAgeDate = new Date(thisYearBirthday)
  nextAgeDate.setMonth(nextAgeDate.getMonth() + 6)

  if (today >= nextAgeDate) {
    age += 1
  }

  return { age, nextAgeDate }
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
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }
  return `${m[1]}-${Number(m[2])}-${Number(m[3])}`
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
