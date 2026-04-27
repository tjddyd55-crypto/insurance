import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'

function cellStr(v) {
  if (v == null) {
    return ''
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(Math.trunc(v))
  }
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).trim()
}

/** @param {string} key */
function foldKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_\-./]/g, '')
}

/** 헤더 별칭 → canonical 필드명 */
const HEADER_ALIAS_PAIRS = [
  ['이름', 'name'],
  ['성명', 'name'],
  ['고객명', 'name'],
  ['name', 'name'],
  ['휴대폰', 'phone'],
  ['전화', 'phone'],
  ['전화번호', 'phone'],
  ['연락처', 'phone'],
  ['핸드폰', 'phone'],
  ['phone', 'phone'],
  ['mobile', 'phone'],
  ['tel', 'phone'],
  ['주민', 'ssn'],
  ['주민번호', 'ssn'],
  ['주민등록번호', 'ssn'],
  ['ssn', 'ssn'],
  ['rrn', 'ssn'],
  ['성별', 'gender'],
  ['gender', 'gender'],
  ['sex', 'gender'],
  ['주소', 'address'],
  ['address', 'address'],
  ['차량번호', 'carNumber'],
  ['차량', 'carNumber'],
  ['차량번호', 'carNumber'],
  ['carnumber', 'carNumber'],
  ['자동차번호', 'carNumber'],
  ['만기', 'renewalDate'],
  ['만기일', 'renewalDate'],
  ['renewaldate', 'renewalDate'],
  ['exp', 'renewalDate'],
  ['직업', 'job'],
  ['job', 'job'],
  ['직업명', 'job'],
  ['비고', 'notes'],
  ['notes', 'notes'],
  ['메모', 'notes'],
]

const CANONICAL_BY_FOLDED = new Map(HEADER_ALIAS_PAIRS.map(([k, v]) => [foldKey(k), v]))

/**
 * @param {Record<string, unknown>} raw
 */
export function mapRawRowToCanonical(raw) {
  /** @type {Record<string, unknown>} */
  const canon = {}
  for (const [k, val] of Object.entries(raw)) {
    const field = CANONICAL_BY_FOLDED.get(foldKey(k))
    if (field && canon[field] === undefined) {
      canon[field] = val
    }
  }
  return canon
}

function normalizeExpiryDate(value) {
  const trimmed = cellStr(value)
  if (!trimmed) {
    return ''
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toISOString().slice(0, 10)
}

/** 주민번호 뒷자리 첫 번째 → gender */
function genderFromRrnDigits(rrnDigits) {
  if (rrnDigits.length < 7) {
    return ''
  }
  const g = rrnDigits[6]
  if (g === '1' || g === '3' || g === '5' || g === '7') {
    return 'male'
  }
  if (g === '2' || g === '4' || g === '6' || g === '8') {
    return 'female'
  }
  return ''
}

function normalizeGenderCell(raw) {
  const s = cellStr(raw).toLowerCase()
  if (!s) {
    return ''
  }
  if (s === 'm' || s === 'male' || s === '남' || s === '남자') {
    return 'male'
  }
  if (s === 'f' || s === 'female' || s === '여' || s === '여자') {
    return 'female'
  }
  return ''
}

/**
 * @param {Record<string, unknown>} raw
 */
export function normalizeImportRow(raw) {
  const canon = mapRawRowToCanonical(raw)
  const name = cellStr(canon.name)
  const phoneRaw = normalizeKrMobile(canon.phone)
  const phoneErr = phoneRaw ? validateKrMobileDigits(phoneRaw) : null
  const ssnDigits = cellStr(canon.ssn).replace(/[^0-9]/g, '')
  const genderCol = normalizeGenderCell(canon.gender)
  const genderRrn = genderFromRrnDigits(ssnDigits)
  let gender = ''
  if (genderCol && genderRrn && genderCol !== genderRrn) {
    gender = ''
  } else if (genderCol) {
    gender = genderCol
  } else if (genderRrn) {
    gender = genderRrn
  }
  const genderConflict = Boolean(genderCol && genderRrn && genderCol !== genderRrn)
  return {
    name,
    phone: phoneErr ? '' : phoneRaw,
    phoneRawDigits: phoneRaw,
    phoneInvalidReason: phoneErr,
    ssn: ssnDigits.length >= 6 ? ssnDigits : '',
    ssnDigits: ssnDigits.length >= 6 ? ssnDigits : '',
    gender,
    genderConflict,
    address: cellStr(canon.address),
    carNumber: cellStr(canon.carNumber),
    renewalDate: normalizeExpiryDate(canon.renewalDate),
    job: cellStr(canon.job),
    driving: '',
    medical: '',
    carrier: '',
    height: '',
    weight: '',
    notesText: cellStr(canon.notes),
  }
}
