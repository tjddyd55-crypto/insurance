/**
 * 일정 관리 달력 요일 색: 일요일 빨강, 토요일 파랑(요일 머리글과 날짜 숫자를 같은 색으로).
 * 공휴일은 별도 데이터 없이 사용자가 Google 에서 고른 캘린더 일정으로만 보인다(색 규칙에 넣지 않음).
 * 날짜는 YYYY-MM-DD 문자열(달력일)만 쓴다. 시간대 변환 없음.
 */
export type ScheduleWeekendTone = 'sun' | 'sat' | null

/** 0=일 … 6=토 (일요일 시작 머리글 순서와 같음) */
export function weekendToneOfIndex(index: number): ScheduleWeekendTone {
  if (index === 0) return 'sun'
  if (index === 6) return 'sat'
  return null
}

export function weekendToneOf(ymd: string): ScheduleWeekendTone {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ''))
  if (!match) return null
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
  return weekendToneOfIndex(day)
}

/** 요소에 붙일 class (없으면 빈 문자열) */
export function weekendToneClass(tone: ScheduleWeekendTone): string {
  return tone ? `schedule-page__tone--${tone}` : ''
}
