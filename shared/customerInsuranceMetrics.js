/**
 * 보험나이·상령일 계산 — src/features/customers/utils/insuranceAge.ts 와 동일 알고리즘.
 * 서버 SMS 대상 검색·스냅샷에서 재사용한다.
 */

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function formatLocalYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function calculateInsuranceAgeFromBirthDate(birthDate, today = new Date()) {
  const birth = startOfDay(birthDate)
  const todayNorm = startOfDay(today)

  let age = todayNorm.getFullYear() - birth.getFullYear()
  const thisYearBirthday = new Date(todayNorm.getFullYear(), birth.getMonth(), birth.getDate())

  if (todayNorm < thisYearBirthday) {
    age -= 1
  }

  const maturityDate = new Date(
    thisYearBirthday.getFullYear(),
    thisYearBirthday.getMonth() + 6,
    thisYearBirthday.getDate(),
  )

  const insuranceAge = todayNorm >= startOfDay(maturityDate) ? age + 1 : age

  return { insuranceAge, maturityDate }
}

export function parseBirthDateFromRrn(rrn) {
  const clean = String(rrn ?? '').replace(/[^0-9]/g, '')
  if (clean.length < 7) {
    return null
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
    return null
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
    return null
  }

  return birthDate
}

export function calculateInsuranceAgeFromRrn(rrn, today = new Date()) {
  const birthDate = parseBirthDateFromRrn(rrn)
  if (!birthDate) {
    return null
  }
  const { insuranceAge, maturityDate } = calculateInsuranceAgeFromBirthDate(birthDate, today)
  return { insuranceAge, maturityDate, birthDate }
}

export function getSangnyeongDday(maturityYmd, today = new Date()) {
  if (!maturityYmd || typeof maturityYmd !== 'string') {
    return null
  }
  const datePart = maturityYmd.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null
  }
  const [y, m, d] = datePart.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const todayNorm = startOfDay(today)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - todayNorm.getTime()) / (1000 * 60 * 60 * 24))
}

export function resolveCustomerInsuranceMetrics(row, today = new Date()) {
  const computed = calculateInsuranceAgeFromRrn(row?.ssn ?? '', today)
  if (computed) {
    return {
      insuranceAge: computed.insuranceAge,
      maturityYmd: formatLocalYmd(computed.maturityDate),
      birthDateYmd: formatLocalYmd(computed.birthDate),
    }
  }

  const insRaw = row?.insurance_age
  const insuranceAge =
    insRaw != null && Number.isFinite(Number(insRaw)) ? Number(insRaw) : null
  let maturityYmd = null
  const nextRaw = row?.next_age_date
  if (nextRaw) {
    const d = nextRaw instanceof Date ? nextRaw : new Date(nextRaw)
    if (!Number.isNaN(d.getTime())) {
      maturityYmd = formatLocalYmd(d)
    }
  }

  let birthDateYmd = null
  if (row?.birth_date) {
    const d = row.birth_date instanceof Date ? row.birth_date : new Date(row.birth_date)
    if (!Number.isNaN(d.getTime())) {
      birthDateYmd = formatLocalYmd(d)
    }
  }

  return { insuranceAge, maturityYmd, birthDateYmd }
}

export function normalizeCustomerGender(raw) {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (g === 'male' || g === 'm' || g === '남' || g === '남자') {
    return 'male'
  }
  if (g === 'female' || g === 'f' || g === '여' || g === '여자') {
    return 'female'
  }
  return null
}

export function formatGenderLabel(gender) {
  if (gender === 'male') {
    return '남자'
  }
  if (gender === 'female') {
    return '여자'
  }
  return '-'
}
