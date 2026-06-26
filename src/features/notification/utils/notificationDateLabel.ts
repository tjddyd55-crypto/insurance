import { formatTargetDateWithDDay, getKstDateString } from '../../../utils/displayDateTime'

/** 알림 목록 기준일 컬럼 — YYYY-MM-DD (D-n) / (D-Day) / (D+n) */
export function formatNotificationTargetDateWithDDay(
  targetDate?: string | null,
  today: string = getKstDateString(),
): string {
  return formatTargetDateWithDDay(targetDate ?? '', today) || '—'
}
