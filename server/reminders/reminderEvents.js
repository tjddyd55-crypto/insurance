import { ymdOrNull } from '../lib/seoulCalendarDate.js'

export const REMINDER_TYPES = ['insurance_age_date', 'car_expiry', 'special_date']

export const REMINDER_TYPE_LABEL = {
  insurance_age_date: '상령일',
  car_expiry: '자동차 만기',
  special_date: '고객 지정 알림',
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function asYmd(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear()
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
    const d = String(raw.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const text = String(raw ?? '').trim()
  const head = text.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null
}

/**
 * 기념일·알림일처럼 매년 반복하는 월-일을 구간 안의 발생일로 펼친다.
 * @param {string | null} dateValue
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function annualOccurrences(dateValue, fromYmd, toYmd) {
  const ymd = asYmd(dateValue)
  if (!ymd || fromYmd > toYmd) {
    return []
  }
  const month = Number(ymd.slice(5, 7))
  const day = Number(ymd.slice(8, 10))
  const fromYear = Number(fromYmd.slice(0, 4))
  const toYear = Number(toYmd.slice(0, 4))
  const dates = []
  for (let year = fromYear; year <= toYear; year += 1) {
    const occurrence = ymdOrNull(year, month, day)
    if (occurrence && occurrence >= fromYmd && occurrence <= toYmd) {
      dates.push(occurrence)
    }
  }
  return dates
}

/**
 * @param {string} type
 * @param {string} customerName
 * @param {string} detail
 */
function eventTitle(type, customerName, detail) {
  const label = REMINDER_TYPE_LABEL[type] ?? type
  const name = customerName.trim() || '고객'
  return detail ? `${name} · ${detail}` : `${name} · ${label}`
}

/**
 * @param {{
 *   ageRows?: Array<Record<string, unknown>>,
 *   carRows?: Array<Record<string, unknown>>,
 *   specialRows?: Array<Record<string, unknown>>,
 *   fromYmd: string,
 *   toYmd: string,
 * }} input
 */
export function assembleReminderEvents(input) {
  const events = []
  for (const row of input.ageRows ?? []) {
    const startDate = asYmd(row.event_date)
    if (!startDate || startDate < input.fromYmd || startDate > input.toYmd) {
      continue
    }
    const customerId = Number(row.customer_id)
    events.push({
      id: `insurance_age_date:${customerId}:${startDate}`,
      type: 'insurance_age_date',
      title: eventTitle('insurance_age_date', String(row.customer_name ?? ''), ''),
      startDate,
      startTime: null,
      customerId,
      customerName: String(row.customer_name ?? ''),
      phone: String(row.phone ?? ''),
      assigneeName: String(row.assignee_name ?? ''),
      content: `${REMINDER_TYPE_LABEL.insurance_age_date} ${startDate}`,
      source: 'customers.next_age_date',
      sourceId: null,
      sourceDate: null,
      sourceTitle: null,
      createdAt: row.created_at ?? null,
    })
  }

  for (const row of input.carRows ?? []) {
    const startDate = asYmd(row.event_date)
    if (!startDate || startDate < input.fromYmd || startDate > input.toYmd) {
      continue
    }
    const customerId = Number(row.customer_id)
    const carId = row.car_id == null ? 'customer' : String(row.car_id)
    const carNumber = String(row.car_number ?? '').trim()
    const detail = carNumber ? `자동차 만기 ${carNumber}` : '자동차 만기'
    events.push({
      id: `car_expiry:${customerId}:${carId}:${startDate}`,
      type: 'car_expiry',
      title: eventTitle('car_expiry', String(row.customer_name ?? ''), detail),
      startDate,
      startTime: null,
      customerId,
      customerName: String(row.customer_name ?? ''),
      phone: String(row.phone ?? ''),
      assigneeName: String(row.assignee_name ?? ''),
      content: carNumber ? `${detail} · ${startDate}` : `자동차 만기 ${startDate}`,
      source: row.car_id == null ? 'customers.renewal_date' : 'customer_cars.renewal_date',
      sourceId: row.car_id == null ? null : Number(row.car_id),
      sourceDate: null,
      sourceTitle: null,
      createdAt: row.created_at ?? null,
    })
  }

  for (const row of input.specialRows ?? []) {
    const dates = annualOccurrences(asYmd(row.date_value), input.fromYmd, input.toYmd)
    const specialId = Number(row.special_date_id)
    const label = String(row.title ?? '').trim() || REMINDER_TYPE_LABEL.special_date
    for (const startDate of dates) {
      events.push({
        id: `special_date:${specialId}:${startDate}`,
        type: 'special_date',
        title: eventTitle('special_date', String(row.customer_name ?? ''), label),
        startDate,
        startTime: null,
        customerId: Number(row.customer_id),
        customerName: String(row.customer_name ?? ''),
        phone: String(row.phone ?? ''),
        assigneeName: String(row.assignee_name ?? ''),
        content: String(row.memo ?? '').trim()
          ? `${label} · ${String(row.memo).trim()}`
          : label,
        source: 'customer_special_dates',
        sourceId: specialId,
        sourceDate: asYmd(row.date_value),
        sourceTitle: label,
        createdAt: row.created_at ?? null,
      })
    }
  }
  return events
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {{ type?: string, query?: string, fromYmd?: string, toYmd?: string }} filter
 */
export function filterReminderEvents(events, filter) {
  const type = filter.type && filter.type !== 'all' ? filter.type : ''
  const query = String(filter.query ?? '').trim().toLowerCase()
  const digits = query.replace(/\D/g, '')
  return events.filter((event) => {
    if (type && event.type !== type) {
      return false
    }
    if (filter.fromYmd && event.startDate < filter.fromYmd) {
      return false
    }
    if (filter.toYmd && event.startDate > filter.toYmd) {
      return false
    }
    if (!query) {
      return true
    }
    const haystack = `${event.customerName} ${event.phone} ${event.content} ${event.title}`.toLowerCase()
    if (haystack.includes(query)) {
      return true
    }
    if (!digits) {
      return false
    }
    return String(event.phone ?? '').replace(/\D/g, '').includes(digits)
  })
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {'soon' | 'late' | 'created' | 'name'} sort
 */
export function sortReminderEvents(events, sort) {
  const copy = [...events]
  copy.sort((a, b) => {
    if (sort === 'late') {
      return compareDate(b.startDate, a.startDate) || compareText(a.customerName, b.customerName)
    }
    if (sort === 'name') {
      return compareText(a.customerName, b.customerName) || compareDate(a.startDate, b.startDate)
    }
    if (sort === 'created') {
      return compareDate(createdYmd(b.createdAt), createdYmd(a.createdAt)) || compareDate(a.startDate, b.startDate)
    }
    return compareDate(a.startDate, b.startDate) || compareText(a.customerName, b.customerName)
  })
  return copy
}

/**
 * @param {Array<{ startDate: string, type: string }>} events
 */
export function countReminderEventsByDay(events) {
  const days = new Map()
  for (const event of events) {
    const current = days.get(event.startDate) ?? { date: event.startDate, count: 0, types: [] }
    current.count += 1
    if (!current.types.includes(event.type)) {
      current.types.push(event.type)
    }
    days.set(event.startDate, current)
  }
  return [...days.values()].sort((a, b) => compareDate(a.date, b.date))
}

function compareDate(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''))
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), 'ko')
}

function createdYmd(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value ?? '')
}
