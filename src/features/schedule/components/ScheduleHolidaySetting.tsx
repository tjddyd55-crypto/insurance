import { useCallback, useSyncExternalStore } from 'react'
import { FormSelect } from '../../../components/form'
import { readScheduleHolidayMode, writeScheduleHolidayMode, type ScheduleHolidayMode } from '../domain/koreanHolidays'
import { getScheduleViewPrefs, queueScheduleViewPrefs, subscribeScheduleViewPrefs } from '../domain/scheduleViewPrefs'

/**
 * 개인 설정: 공휴일 표시(대한민국 공휴일 / 표시 안 함).
 * 사용자별 서버 설정(holidayMode)이 우선, 없으면 이전 브라우저 설정 → 기본 'kr'.
 */
export function useScheduleHolidayMode(userKey?: string, token?: string | null): [ScheduleHolidayMode, (mode: ScheduleHolidayMode) => void] {
  const userId = userKey || ''
  const prefs = useSyncExternalStore(subscribeScheduleViewPrefs, () => getScheduleViewPrefs(userId), () => getScheduleViewPrefs(userId))
  const mode: ScheduleHolidayMode = prefs.holidayMode ?? readScheduleHolidayMode(userId || undefined)
  const update = useCallback((next: ScheduleHolidayMode) => {
    writeScheduleHolidayMode(userId || undefined, next)
    queueScheduleViewPrefs(userId, token, { holidayMode: next })
  }, [token, userId])
  return [mode, update]
}

export default function ScheduleHolidaySetting({ mode, onChange }: { mode: ScheduleHolidayMode; onChange: (mode: ScheduleHolidayMode) => void }) {
  return (
    <div className="schedule-page__holiday-setting">
      <span className="schedule-page__holiday-legend" aria-hidden="true">
        <span className="schedule-page__legend schedule-page__legend--sun">일·공휴일</span>
        <span className="schedule-page__legend schedule-page__legend--sat">토</span>
      </span>
      <label className="schedule-page__holiday-label">
        공휴일 표시
        <FormSelect
          className="schedule-page__holiday-select"
          value={mode}
          onChange={(e) => onChange(e.target.value === 'none' ? 'none' : 'kr')}
          options={[
            { value: 'kr', label: '대한민국 공휴일' },
            { value: 'none', label: '표시 안 함' },
          ]}
          aria-label="공휴일 표시"
        />
      </label>
    </div>
  )
}
