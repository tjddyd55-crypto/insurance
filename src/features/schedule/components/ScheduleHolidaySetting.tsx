import { useCallback, useState } from 'react'
import { FormSelect } from '../../../components/form'
import { readScheduleHolidayMode, writeScheduleHolidayMode, type ScheduleHolidayMode } from '../domain/koreanHolidays'

/** 개인 설정: 공휴일 표시(대한민국 공휴일 / 표시 안 함). 브라우저에 사용자별로 저장한다. */
export function useScheduleHolidayMode(userKey?: string): [ScheduleHolidayMode, (mode: ScheduleHolidayMode) => void] {
  const userId = userKey || undefined
  const [state, setState] = useState<{ userId: string | undefined; mode: ScheduleHolidayMode }>(() => ({ userId, mode: readScheduleHolidayMode(userId) }))
  const mode = state.userId === userId ? state.mode : readScheduleHolidayMode(userId)
  const update = useCallback((next: ScheduleHolidayMode) => {
    writeScheduleHolidayMode(userId, next)
    setState({ userId, mode: next })
  }, [userId])
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
