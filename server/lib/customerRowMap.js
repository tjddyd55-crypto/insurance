/**
 * Customers 테이블 행 → 공개 API 형식 (server/index.js 와 동일 규약).
 */
import { parseCrmExtensionFromDb } from './customerCrmExtension.js'
import { summarizeConsultationBody } from './customerConsultationListQuery.js'
import { isClosedFollowUpStatus } from './customerConsultationFollowUp.js'
import { inflowSourceFromDbRow, referrerNameFromDbRow } from './customerInflowSource.js'

export function normalizeExpiryDate(value) {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
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

export function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value ?? '')
  }
  return parsed.toISOString()
}

function normalizeCustomerNoteItemsArray(itemsRaw) {
  if (!Array.isArray(itemsRaw)) {
    return []
  }
  const out = []
  for (const item of itemsRaw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const id = String(item.id ?? '').trim()
    const content = String(item.content ?? '').trim()
    const createdAt = String(item.createdAt ?? new Date().toISOString()).trim()
    if (!id || !content) {
      continue
    }
    out.push({ id, content, createdAt })
  }
  return out
}

/** API 응답: { items, insuranceHistory } — 레거시 배열도 수용 */
export function mapCustomerNotesJson(raw) {
  if (raw == null) {
    return { items: [], insuranceHistory: '' }
  }
  if (Array.isArray(raw)) {
    return { items: normalizeCustomerNoteItemsArray(raw), insuranceHistory: '' }
  }
  if (typeof raw === 'object') {
    const insuranceHistory = String(raw.insuranceHistory ?? '').trim()
    const items = normalizeCustomerNoteItemsArray(raw.items)
    return { items, insuranceHistory }
  }
  return { items: [], insuranceHistory: '' }
}

export function mapCustomerRow(row) {
  const renewalRaw = row.renewal_date ?? ''
  const renewalDate =
    renewalRaw instanceof Date
      ? normalizeExpiryDate(renewalRaw.toISOString().slice(0, 10))
      : normalizeExpiryDate(String(renewalRaw))

  const g = String(row.gender ?? '').trim()
  const gender = g === 'male' || g === 'female' ? g : null

  let isDriver = null
  if (row.is_driver === true) {
    isDriver = true
  } else if (row.is_driver === false) {
    isDriver = false
  }

  const nextRaw = row.next_age_date ?? null
  let nextAgeDate = null
  if (nextRaw instanceof Date) {
    nextAgeDate = normalizeExpiryDate(nextRaw.toISOString().slice(0, 10))
  } else if (nextRaw) {
    nextAgeDate = normalizeExpiryDate(String(nextRaw).slice(0, 10))
  }

  const insRaw = row.insurance_age
  const insuranceAge =
    insRaw != null && insRaw !== '' && Number.isFinite(Number(insRaw)) ? Number(insRaw) : null

  const lastConsultRaw = row.last_consult_date ?? row.lastConsultDate ?? null
  let lastConsultDate = null
  if (lastConsultRaw instanceof Date) {
    lastConsultDate = lastConsultRaw.toISOString().slice(0, 10)
  } else if (lastConsultRaw) {
    const parsed = new Date(String(lastConsultRaw))
    if (!Number.isNaN(parsed.getTime())) {
      lastConsultDate = parsed.toISOString().slice(0, 10)
    } else {
      const ymd = String(lastConsultRaw).slice(0, 10)
      lastConsultDate = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
    }
  }

  let birthDate = null
  const bdRaw = row.birth_date
  if (bdRaw instanceof Date) {
    birthDate = bdRaw.toISOString().slice(0, 10)
  } else if (bdRaw) {
    birthDate = String(bdRaw).slice(0, 10)
  }

  const crmParsed = parseCrmExtensionFromDb(row.crm_extension ?? row.crmExtension)

  const consultCountRaw = row.consultation_count ?? row.consultationCount
  const consultationCount =
    consultCountRaw != null && consultCountRaw !== '' && Number.isFinite(Number(consultCountRaw))
      ? Number(consultCountRaw)
      : 0

  const lastConsultationSummary = summarizeConsultationBody(
    row.last_consultation_body ?? row.lastConsultationBody ?? row.last_consultation_memo,
  )

  const inflowSource = inflowSourceFromDbRow(row)
  const referrerName = referrerNameFromDbRow(row)

  const followUpNextRaw =
    row.follow_up_next_contact_date ?? row.followUpNextContactDate ?? row.next_contact_date ?? null
  let nextContactDate = null
  if (followUpNextRaw instanceof Date) {
    nextContactDate = followUpNextRaw.toISOString().slice(0, 10)
  } else if (followUpNextRaw) {
    const ymd = String(followUpNextRaw).slice(0, 10)
    nextContactDate = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
  }

  const followUpStatusRaw = row.follow_up_status ?? row.followUpStatus ?? null
  const followUpStatus =
    followUpStatusRaw == null || String(followUpStatusRaw).trim() === ''
      ? null
      : String(followUpStatusRaw).trim()

  const contactResultRaw = row.follow_up_contact_result ?? row.followUpContactResult ?? row.contact_result ?? null
  const contactResult =
    contactResultRaw == null || String(contactResultRaw).trim() === ''
      ? null
      : String(contactResultRaw).trim()

  const followUpNotePreview = summarizeConsultationBody(
    row.follow_up_note ?? row.followUpNote ?? row.follow_up_note_preview,
    80,
  )

  const todayYmd = new Date().toISOString().slice(0, 10)
  const followUpOpen = nextContactDate != null && !isClosedFollowUpStatus(followUpStatus)
  const overdueFollowUp = followUpOpen && nextContactDate < todayYmd
  const todayFollowUp = followUpOpen && nextContactDate === todayYmd

  return {
    id: Number(row.id),
    userId: String(row.user_id),
    name: row.name ?? '',
    customerCode: row.customer_code != null ? String(row.customer_code) : null,
    birthDate,
    ssn: row.ssn ?? '',
    gender,
    insuranceAge,
    nextAgeDate: nextAgeDate || null,
    isDriver,
    carType: row.car_type ?? '',
    notes: mapCustomerNotesJson(row.notes),
    phone: row.phone ?? row.phone_number ?? '',
    carrier: row.carrier ?? '',
    address: row.address ?? '',
    height: row.height ?? '',
    weight: row.weight ?? '',
    job: row.job ?? '',
    driving: row.driving ?? '',
    medical: row.medical ?? '',
    carNumber: row.car_number ?? '',
    carModel: row.car_model ?? '',
    carYear: row.car_year ?? '',
    renewalDate,
    lastConsultDate,
    lastConsultationAt: lastConsultDate,
    lastConsultationMemo: lastConsultationSummary,
    lastConsultationSummary,
    consultationCount,
    hasConsultation: consultationCount > 0,
    inflowSource,
    referrerName,
    nextContactDate,
    followUpStatus,
    contactResult,
    followUpNotePreview,
    overdueFollowUp,
    todayFollowUp,
    isFavorite: row.is_favorite === true,
    crmExtension: crmParsed,
    createdAt: toIsoString(row.created_at),
  }
}
