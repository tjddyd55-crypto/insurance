/**
 * GET 검색 등에서 customers 행을 API 응답 형태로 매핑 (index.js mapCustomerRow 와 동일 규약).
 */
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

function normalizeNoteItemsFromDb(itemsRaw) {
  if (!Array.isArray(itemsRaw)) {
    return []
  }
  return itemsRaw
    .map((item) => ({
      id: String(item?.id ?? '').trim(),
      content: String(item?.content ?? '').trim(),
      createdAt: String(item?.createdAt ?? '').trim(),
    }))
    .filter((n) => n.id && n.content && n.createdAt)
}

/** API 응답: { items, insuranceHistory } — 레거시 배열도 수용 */
export function mapCustomerNotesJson(raw) {
  if (raw == null) {
    return { items: [], insuranceHistory: '' }
  }
  if (Array.isArray(raw)) {
    return { items: normalizeNoteItemsFromDb(raw), insuranceHistory: '' }
  }
  if (typeof raw === 'object') {
    const insuranceHistory = String(raw.insuranceHistory ?? '').trim()
    const items = normalizeNoteItemsFromDb(raw.items)
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

  return {
    id: Number(row.id),
    userId: String(row.user_id),
    name: row.name ?? '',
    ssn: row.ssn ?? '',
    gender,
    insuranceAge,
    nextAgeDate: nextAgeDate || null,
    isDriver,
    carType: row.car_type ?? '',
    notes: mapCustomerNotesJson(row.notes),
    phone: row.phone ?? '',
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
    isFavorite: row.is_favorite === true,
    createdAt: toIsoString(row.created_at),
  }
}
