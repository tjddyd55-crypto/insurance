import { formatDateOnly, getKstDateString } from '../../../shared/dateTimeKst.js'

/** Align with src/features/claim-requests/utils/claimRequestStatusUi.ts */
const CLAIM_STATUS_LABEL = Object.freeze({
  requested: '요청됨',
  processing: '처리중',
  done: '완료',
  rejected: '거절',
  canceled: '취소',
})

/**
 * @param {string | null | undefined} status
 */
export function formatClaimStatusLabel(status) {
  const key = String(status ?? '').trim().toLowerCase()
  if (!key) {
    return '—'
  }
  return CLAIM_STATUS_LABEL[key] ?? status
}

/**
 * @param {string | null | undefined} ymd
 */
export function formatKoreanMonthDay(ymd) {
  const d = formatDateOnly(ymd)
  if (!d) {
    return ''
  }
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0))
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  }).format(dt)
}

/**
 * @param {string | null | undefined} dueDateYmd
 * @param {'today' | 'tomorrow' | 'week'} scope
 * @param {{ force?: boolean }} [options]
 */
export function formatTodoDueSuffix(dueDateYmd, scope, options = {}) {
  if (!dueDateYmd) {
    return ''
  }
  if (!options.force && (scope === 'today' || scope === 'tomorrow')) {
    return ''
  }
  const today = getKstDateString()
  const d = formatDateOnly(dueDateYmd)
  if (!d || d === today) {
    return ''
  }
  const label = formatKoreanMonthDay(d)
  return label ? ` (${label})` : ''
}

/**
 * @param {string} title
 * @param {string | null | undefined} customerName
 */
export function formatScheduleEventLine(ev) {
  const title = String(ev.title ?? '').trim() || '일정'
  const customerName = String(ev.customerName ?? '').trim()
  let displayTitle = title
  if (customerName && title.startsWith(`${customerName} ·`)) {
    displayTitle = title
  } else if (customerName && title.includes(customerName)) {
    displayTitle = title
  } else if (customerName && !title.includes(customerName)) {
    displayTitle = `${customerName} — ${title}`
  }
  const time = formatScheduleTime(ev.startTime ?? ev.time ?? null)
  if (time) {
    return `${time} — ${displayTitle}`
  }
  return displayTitle
}

/**
 * @param {unknown} raw
 */
function formatScheduleTime(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  if (/^\d{1,2}:\d{2}/.test(text)) {
    const [h, m] = text.split(':').map(Number)
    const dt = new Date(Date.UTC(2000, 0, 1, h, m, 0))
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(dt)
  }
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  }
  return ''
}
