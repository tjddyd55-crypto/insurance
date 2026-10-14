/**
 * 대한민국 법정 공휴일(대체공휴일·임시공휴일 포함) 정적 표. 외부 API 없이 달력 색 표시용으로만 쓴다.
 * 범위 밖 연도는 빈 값 → 공휴일 없이 일요일/토요일 색만 적용된다. 매년 말에 다음 해를 추가한다.
 */
export const KOREAN_HOLIDAYS: Readonly<Record<string, string>> = Object.freeze({
  '2025-01-01': '신정', '2025-01-28': '설날 연휴', '2025-01-29': '설날', '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절', '2025-03-03': '대체공휴일', '2025-05-05': '어린이날·부처님오신날', '2025-05-06': '대체공휴일',
  '2025-06-03': '대통령선거일', '2025-06-06': '현충일', '2025-08-15': '광복절', '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴', '2025-10-06': '추석', '2025-10-07': '추석 연휴', '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날', '2025-12-25': '성탄절',
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일', '2026-06-03': '전국동시지방선거', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석 연휴',
  '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일',
})

export type ScheduleHolidayMode = 'kr' | 'none'

/** @param ymd YYYY-MM-DD */
export function koreanHolidayName(ymd: string, mode: ScheduleHolidayMode): string {
  if (mode !== 'kr') return ''
  return KOREAN_HOLIDAYS[ymd] ?? ''
}

/** 0=일 … 6=토 (달력 날짜 기준, 시간대 무관) */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export type ScheduleDayTone = '' | 'sun' | 'sat' | 'holiday'

/** 일요일·공휴일 빨강, 토요일 파랑. 토요일 공휴일은 공휴일(빨강) 우선. */
export function scheduleDayTone(ymd: string, mode: ScheduleHolidayMode): ScheduleDayTone {
  if (koreanHolidayName(ymd, mode)) return 'holiday'
  const day = weekdayOfYmd(ymd)
  if (day === 0) return 'sun'
  if (day === 6) return 'sat'
  return ''
}

const PREF_PREFIX = 'onefc.schedule.holidayMode.'

/** 개인 설정(브라우저·사용자별). 기본은 대한민국 공휴일 표시. */
export function readScheduleHolidayMode(userId: string | undefined, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): ScheduleHolidayMode {
  try {
    const raw = storage?.getItem(PREF_PREFIX + (userId || 'anon'))
    return raw === 'none' ? 'none' : 'kr'
  } catch {
    return 'kr'
  }
}

export function writeScheduleHolidayMode(userId: string | undefined, mode: ScheduleHolidayMode, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(PREF_PREFIX + (userId || 'anon'), mode)
  } catch {
    /* 저장 실패 시 이번 화면에서만 적용 */
  }
}
