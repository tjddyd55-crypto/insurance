import { formatKstDate, formatKstTime } from '../../../utils/displayDateTime'

const MINUTES_PER_DAY = 24 * 60

export type NowLinePlacement = {
  date: string
  minute: number
  topPercent: number
}

/** 다음 분 경계까지 남은 밀리초. 0초면 한 분 뒤. */
export function msUntilNextMinute(now: Date): number {
  const intoMinute = now.getSeconds() * 1000 + now.getMilliseconds()
  return intoMinute === 0 ? 60_000 : 60_000 - intoMinute
}

function seoulMinute(now: Date): { date: string; minute: number } | null {
  const date = formatKstDate(now)
  const clock = formatKstTime(now)
  if (!date || !clock) return null
  const [hour, minute] = clock.split(':').map(Number)
  if (hour > 23 || minute > 59) return null
  return { date, minute: hour * 60 + minute }
}

/**
 * 오늘(Asia/Seoul)이 보이는 주 안에 있을 때만 시간 축 위치.
 * topPercent 는 00:00~24:00 그리드 높이의 비율(분 단위).
 */
export function currentTimeLinePlacement(now: Date, weekDates: readonly string[]): NowLinePlacement | null {
  const point = seoulMinute(now)
  if (!point || !weekDates.includes(point.date)) return null
  if (point.minute < 0 || point.minute >= MINUTES_PER_DAY) return null
  return { date: point.date, minute: point.minute, topPercent: (point.minute / MINUTES_PER_DAY) * 100 }
}
