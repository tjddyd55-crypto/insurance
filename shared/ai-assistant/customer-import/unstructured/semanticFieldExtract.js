/**
 * Unstructured block → semantic fields (meaning first, before ONE FC DB keys).
 *
 * @typedef {object} UnstructuredSemanticRecord
 * @property {string} personName
 * @property {string} gender
 * @property {string} residentRegistrationNumber
 * @property {string[]} phones
 * @property {string} address
 * @property {string} detailAddress
 * @property {string} height
 * @property {string} weight
 * @property {string} job
 * @property {string} company
 * @property {string} drivingStatus
 * @property {string} carType
 * @property {string} carNumber
 * @property {string} carModel
 * @property {string} carYear
 * @property {string} renewalDate
 * @property {string} medical
 * @property {string} insuranceHistory
 * @property {string} memo
 * @property {string[]} unresolvedLines
 * @property {boolean} needsSemanticReview
 */

const PHONE_LABEL =
  /(?:핸드폰번호|휴대폰번호|전화번호|핸드폰|휴대|전화|H\.?P|연락처|모바일|Mobile)\s*[:：]?\s*([0-9\s\-().]{9,20})/i
const NAME_LABEL = /(?:이름|성명|고객명)\s*[:：]\s*([^\n\r]+)/i
const ADDRESS_LABEL = /(?:주소|거주지|Address)\s*[:：]\s*([^\n\r]+)/i
const JOB_LABEL = /(?:직업|회사|하는일)\s*[:：]\s*([^\n\r]+)/i
const RRN_LABEL = /주민(?:등록)?번호\s*[:：]\s*(\d{6}[-\s]?\d{7})/i
const HEIGHT_WEIGHT_LABEL = /키\s*\/\s*몸무게\s*[:：]\s*(\d{2,3})\s*\/\s*(\d{2,3})/i
const HEIGHT_LABEL = /키\s*[:：]\s*(\d{2,3})/i
const WEIGHT_LABEL = /몸무게\s*[:：]\s*(\d{2,3})/i
const CAR_LABEL = /(?:차번호|번호판|자동차번호|차량번호)\s*[:：]\s*([^\n\r]+)/i
const CAR_PLATE_PATTERN = /\b(\d{2,3}[가-힣]\d{4})\b/
const MEDICAL_LABEL = /(?:병력|병력사항|질병)\s*[:：]\s*([^\n\r]+)/i
const INSURANCE_LABEL = /(?:보험|보험가입|가입내역)\s*[:：]\s*([^\n\r]+)/i
const MEMO_LABEL = /(?:메모|비고|특이사항)\s*[:：]\s*([^\n\r]+)/i
const LEADING_NAME_ON_SAME_LINE = /^([가-힣]{2,8})(?=\s+(?:주민|키\/|핸드|휴대|전화|주소|직업|회사|병력|보험|차))/i
const FIELD_LABEL_START =
  /^(?:주민번호|핸드폰|휴대|전화|주소|키\s*\/\s*몸무게|키|몸무게|직업|회사|병원|보험|메모|계좌|청구|차번호)/i
const INLINE_NEXT_FIELD_LABEL =
  /\s+(?=(?:주민(?:등록)?번호|핸드폰번호|휴대폰번호|전화번호|핸드폰|휴대|전화|H\.?P|연락처|키\s*\/\s*몸무게|키|몸무게|직업|회사|하는일|병력|보험|메모|비고|차번호|번호판|자동차번호|차량번호)\s*[:：])/i

function trimLabeledFieldValue(raw) {
  const value = String(raw ?? '').trim()
  if (!value) {
    return ''
  }
  const firstLine = value.split(/\r?\n/)[0] ?? value
  const inline = firstLine.split(INLINE_NEXT_FIELD_LABEL)[0]?.trim() ?? firstLine.trim()
  return inline.slice(0, 200)
}

function normalizePhoneDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 11) {
    return ''
  }
  if (digits.length === 10) {
    return `0${digits}`
  }
  return digits
}

function sanitizePersonNameToken(token) {
  const cleaned = String(token ?? '')
    .replace(/^(이름|성명|고객명)\s*[:：]\s*/i, '')
    .trim()
    .split(/\s+/)[0]
  if (!cleaned || FIELD_LABEL_START.test(cleaned) || /[0-9:：]/.test(cleaned)) {
    return ''
  }
  if (cleaned.length > 12) {
    return ''
  }
  return cleaned
}

function extractPhonesFromText(text) {
  const found = new Set()
  const labeled = text.match(new RegExp(PHONE_LABEL.source, 'gi')) ?? []
  for (const block of labeled) {
    const m = block.match(PHONE_LABEL)
    if (m?.[1]) {
      const p = normalizePhoneDigits(m[1])
      if (p) {
        found.add(p)
      }
    }
  }
  const loose = String(text ?? '').match(/01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/g) ?? []
  for (const raw of loose) {
    const p = normalizePhoneDigits(raw)
    if (p) {
      found.add(p)
    }
  }
  return [...found]
}

function normalizeResidentId(raw) {
  const m = String(raw ?? '').match(/(\d{6})[-\s]?(\d{7})/)
  if (!m) {
    return ''
  }
  return `${m[1]}${m[2]}`
}

function consumeLine(line, semantic) {
  const trimmed = line.trim()
  if (!trimmed) {
    return true
  }

  let m = RRN_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.residentRegistrationNumber = normalizeResidentId(m[1])
    return true
  }

  m = HEIGHT_WEIGHT_LABEL.exec(trimmed)
  if (m?.[1] && m?.[2]) {
    semantic.height = m[1]
    semantic.weight = m[2]
    return true
  }

  m = HEIGHT_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.height = m[1]
    return true
  }

  m = WEIGHT_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.weight = m[1]
    return true
  }

  m = PHONE_LABEL.exec(trimmed)
  if (m?.[1]) {
    const p = normalizePhoneDigits(m[1])
    if (p) {
      semantic.phones.push(p)
    }
    return true
  }

  m = ADDRESS_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.address = trimLabeledFieldValue(m[1])
    return true
  }

  m = JOB_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.job = m[1].trim().slice(0, 80)
    return true
  }

  m = CAR_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.carNumber = m[1].trim().slice(0, 20)
    return true
  }

  m = MEDICAL_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.medical = m[1].trim().slice(0, 500)
    return true
  }

  m = INSURANCE_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.insuranceHistory = m[1].trim().slice(0, 500)
    return true
  }

  m = MEMO_LABEL.exec(trimmed)
  if (m?.[1]) {
    semantic.memo = m[1].trim().slice(0, 500)
    return true
  }

  m = NAME_LABEL.exec(trimmed)
  if (m?.[1]) {
    const name = sanitizePersonNameToken(m[1])
    if (name) {
      semantic.personName = name
    }
    return true
  }

  if (/^([가-힣]{2,8})$/.test(trimmed)) {
    if (!semantic.personName) {
      semantic.personName = trimmed
    }
    return true
  }

  const leading = LEADING_NAME_ON_SAME_LINE.exec(trimmed)
  if (leading?.[1] && !semantic.personName) {
    semantic.personName = sanitizePersonNameToken(leading[1])
    return true
  }

  if (FIELD_LABEL_START.test(trimmed)) {
    semantic.unresolvedLines.push(trimmed)
    semantic.needsSemanticReview = true
    return true
  }

  const plate = CAR_PLATE_PATTERN.exec(trimmed)
  if (plate?.[1] && !semantic.carNumber) {
    semantic.carNumber = plate[1]
    return true
  }

  semantic.unresolvedLines.push(trimmed)
  semantic.needsSemanticReview = true
  return false
}

/**
 * @param {string} text
 * @returns {UnstructuredSemanticRecord}
 */
export function parseUnstructuredBlockToSemantic(text) {
  const raw = String(text ?? '')
  /** @type {UnstructuredSemanticRecord} */
  const semantic = {
    personName: '',
    gender: '',
    residentRegistrationNumber: '',
    phones: [],
    address: '',
    detailAddress: '',
    height: '',
    weight: '',
    job: '',
    company: '',
    drivingStatus: '',
    carType: '',
    carNumber: '',
    carModel: '',
    carYear: '',
    renewalDate: '',
    medical: '',
    insuranceHistory: '',
    memo: '',
    unresolvedLines: [],
    needsSemanticReview: false,
  }

  const fromNameLabel = NAME_LABEL.exec(raw)?.[1]?.trim()
  if (fromNameLabel) {
    const labeled = sanitizePersonNameToken(fromNameLabel)
    if (labeled) {
      semantic.personName = labeled
    }
  }

  const leading = LEADING_NAME_ON_SAME_LINE.exec(raw)
  if (leading?.[1] && !semantic.personName) {
    semantic.personName = sanitizePersonNameToken(leading[1])
  }

  if (RRN_LABEL.test(raw) && !semantic.residentRegistrationNumber) {
    const rrn = RRN_LABEL.exec(raw)
    if (rrn?.[1]) {
      semantic.residentRegistrationNumber = normalizeResidentId(rrn[1])
    }
  }

  if (HEIGHT_WEIGHT_LABEL.test(raw) && !semantic.height) {
    const hw = HEIGHT_WEIGHT_LABEL.exec(raw)
    if (hw?.[1] && hw?.[2]) {
      semantic.height = hw[1]
      semantic.weight = hw[2]
    }
  }

  if (ADDRESS_LABEL.test(raw) && !semantic.address) {
    const blockMatch = /(?:주소|거주지|Address)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:주민|핸드폰|휴대|전화|키\s*\/\s*몸무게|직업|회사|병력|보험|메모|차번호)|$)/i.exec(
      raw,
    )
    semantic.address = trimLabeledFieldValue(blockMatch?.[1] ?? ADDRESS_LABEL.exec(raw)?.[1] ?? '')
  }

  if (JOB_LABEL.test(raw) && !semantic.job) {
    semantic.job = JOB_LABEL.exec(raw)?.[1]?.trim().slice(0, 80) ?? ''
  }

  if (CAR_LABEL.test(raw) && !semantic.carNumber) {
    semantic.carNumber = CAR_LABEL.exec(raw)?.[1]?.trim().slice(0, 20) ?? ''
  } else if (!semantic.carNumber) {
    const plate = CAR_PLATE_PATTERN.exec(raw)
    if (plate?.[1]) {
      semantic.carNumber = plate[1]
    }
  }

  for (const phone of extractPhonesFromText(raw)) {
    if (!semantic.phones.includes(phone)) {
      semantic.phones.push(phone)
    }
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    consumeLine(line, semantic)
  }

  if (!semantic.personName) {
    for (const line of lines) {
      if (FIELD_LABEL_START.test(line) || PHONE_LABEL.test(line)) {
        continue
      }
      if (/^([가-힣]{2,8})$/.test(line)) {
        semantic.personName = line
        break
      }
    }
  }

  semantic.phones = [...new Set(semantic.phones)]
  if (semantic.unresolvedLines.length > 0) {
    semantic.needsSemanticReview = true
  }
  if (semantic.phones.length > 1) {
    semantic.needsSemanticReview = true
  }
  if (!semantic.personName && semantic.phones.length === 0) {
    semantic.needsSemanticReview = true
  }

  return semantic
}

/** @param {string} text */
export function extractPersonNameFromBlock(text) {
  return parseUnstructuredBlockToSemantic(text).personName
}
