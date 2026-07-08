/**
 * Asia/Seoul 기준 next_run_at 계산 (CRM 예약문자 worker).
 */

function parseSendTime(sendTime) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(sendTime ?? '').trim())
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null
  }
  return { hour, minute }
}

function seoulOnceIso(sendDate, sendTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sendDate ?? ''))) {
    return null
  }
  const time = parseSendTime(sendTime)
  if (!time) {
    return null
  }
  const hh = String(time.hour).padStart(2, '0')
  const mm = String(time.minute).padStart(2, '0')
  const candidate = new Date(`${sendDate}T${hh}:${mm}:00+09:00`)
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString()
}

function seoulNowParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    weekday: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date()),
  }
}

function seoulWeekdayNumber() {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date())
  const map = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[wd] ?? 1
}

function buildSeoulIso(y, m, d, hour, minute) {
  const sendDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const sendTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return seoulOnceIso(sendDate, sendTime)
}

/**
 * @param {{
 *   scheduleType: string;
 *   sendDate?: string | null;
 *   sendTime: string;
 *   weekdays?: number[];
 *   monthDay?: number | null;
 *   enabled?: boolean;
 * }} input
 * @returns {string | null}
 */
export function computeScheduledNextRunAt(input) {
  if (input.enabled === false) {
    return null
  }
  const time = parseSendTime(input.sendTime)
  if (!time) {
    return null
  }
  const { hour, minute } = time
  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)

  if (input.scheduleType === 'once') {
    const iso = seoulOnceIso(input.sendDate, input.sendTime)
    if (!iso) {
      return null
    }
    return Date.parse(iso) > nowMs ? iso : null
  }

  const seoul = seoulNowParts()

  if (input.scheduleType === 'daily') {
    let iso = buildSeoulIso(seoul.year, seoul.month, seoul.day, hour, minute)
    if (iso && Date.parse(iso) <= nowMs) {
      const tomorrow = new Date(`${seoul.year}-${String(seoul.month).padStart(2, '0')}-${String(seoul.day).padStart(2, '0')}T12:00:00+09:00`)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      const y = tomorrow.getUTCFullYear()
      const m = tomorrow.getUTCMonth() + 1
      const d = tomorrow.getUTCDate()
      iso = buildSeoulIso(y, m, d, hour, minute)
    }
    return iso
  }

  if (input.scheduleType === 'weekly') {
    const weekdays = Array.isArray(input.weekdays) ? [...input.weekdays].sort((a, b) => a - b) : []
    if (!weekdays.length) {
      return null
    }
    const jsWeekday = seoulWeekdayNumber()
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = ((jsWeekday - 1 + offset) % 7) + 1
      if (!weekdays.includes(day)) {
        continue
      }
      const base = new Date(`${seoul.year}-${String(seoul.month).padStart(2, '0')}-${String(seoul.day).padStart(2, '0')}T12:00:00+09:00`)
      base.setUTCDate(base.getUTCDate() + offset)
      const iso = buildSeoulIso(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute)
      if (iso && Date.parse(iso) > nowMs) {
        return iso
      }
    }
    return null
  }

  if (input.scheduleType === 'monthly') {
    const day = Number(input.monthDay ?? 1)
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      return null
    }
    let iso = buildSeoulIso(seoul.year, seoul.month, day, hour, minute)
    if (iso && Date.parse(iso) <= nowMs) {
      const nextMonth = seoul.month === 12 ? 1 : seoul.month + 1
      const nextYear = seoul.month === 12 ? seoul.year + 1 : seoul.year
      iso = buildSeoulIso(nextYear, nextMonth, day, hour, minute)
    }
    return iso
  }

  return null
}

export function assertScheduledNextRunInFuture(nextRunAt) {
  if (!nextRunAt) {
    const err = new Error('sms_schedule_past')
    err.status = 400
    err.publicMessage = '예약 발송 시간은 현재 시각 이후여야 합니다.'
    throw err
  }
  if (Date.parse(nextRunAt) <= Date.now()) {
    const err = new Error('sms_schedule_past')
    err.status = 400
    err.publicMessage = '예약 발송 시간은 현재 시각 이후여야 합니다.'
    throw err
  }
}
