import {
  addYearsToYmd,
  coerceStoredDateValue,
  diffCalendarDaysYmd,
  todayInSeoul,
} from '../../../utils/dateInput'

/**
 * API `nextAgeDate` 기준. 이미 지난 상령일이면 동일 월·일의 다음 회차로 롤포워드.
 * Native `customerDetailPresentation.resolveInsuranceAgeTargetDate` 와 동일.
 */
export function resolveInsuranceAgeTargetDate(
  nextAgeDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const stored = coerceStoredDateValue(nextAgeDate ?? '')
  if (!stored) {
    return null
  }
  const todayYmd = todayInSeoul(now)
  let cursor = stored
  for (let guard = 0; guard < 120; guard += 1) {
    const diff = diffCalendarDaysYmd(cursor, todayYmd)
    if (diff === null) {
      return null
    }
    if (diff >= 0) {
      return cursor
    }
    const rolled = addYearsToYmd(cursor, 1)
    if (!rolled) {
      return null
    }
    cursor = rolled
  }
  return null
}

/** 상령일 D-day — Native `getInsuranceAgeDdayLabel` (`D-N` 또는 `오늘`) */
export function getInsuranceAgeDdayLabel(
  nextAgeDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const targetYmd = resolveInsuranceAgeTargetDate(nextAgeDate, now)
  if (!targetYmd) {
    return null
  }
  const diff = diffCalendarDaysYmd(targetYmd, todayInSeoul(now))
  if (diff === null || diff < 0) {
    return null
  }
  if (diff === 0) {
    return '오늘'
  }
  return `D-${diff}`
}
