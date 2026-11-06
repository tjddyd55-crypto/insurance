/* eslint-disable no-restricted-syntax -- 주간 시간 블록은 버튼 모양이 아닌 달력 칸이라 native button 을 쓴다(ScheduleBoards 와 같은 방식). */
import { useEffect, useState, type CSSProperties } from 'react'
import type { ScheduleEvent } from '../api/scheduleApi'
import { currentTimeLinePlacement, msUntilNextMinute } from '../domain/scheduleNowLine'
import { timedEventRangeLabel, WEEK_SLOTS_PER_DAY, weekTimedSegments } from '../domain/scheduleWeekTimedLayout'

const HOURS = Array.from({ length: 24 }, (_, index) => index)

type Props = {
  days: string[]
  events: ScheduleEvent[]
  onOpenEvent: (event: ScheduleEvent) => void
  eventClassName: (event: ScheduleEvent) => string
  /** 테스트용 고정 시각. 없으면 서울 현재 시각을 분마다 갱신한다. */
  now?: Date
}

function useScheduleClock(fixed: Date | undefined): Date {
  const [clock, setClock] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return undefined
    let timer = 0
    const arm = () => {
      timer = window.setTimeout(() => {
        setClock(new Date())
        arm()
      }, msUntilNextMinute(new Date()))
    }
    arm()
    return () => window.clearTimeout(timer)
  }, [fixed])
  return fixed ?? clock
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/**
 * 주간 시간 축. 일정은 캘린더 그리드 행(30분)으로 시작~종료를 채운다.
 * 위치는 행 번호만 넘기고, 높이는 CSS 칸 높이가 결정한다.
 */
export function ScheduleWeekTimeGrid({ days, events, onOpenEvent, eventClassName, now }: Props) {
  const segments = weekTimedSegments(events, days)
  const clock = useScheduleClock(now)
  const nowLine = currentTimeLinePlacement(clock, days)
  const gridStyle = { '--schedule-week-slots': String(WEEK_SLOTS_PER_DAY) } as CSSProperties
  return (
    <div className="schedule-page__time-grid" style={gridStyle}>
      {HOURS.map((hour) => (
        <span
          key={hour}
          className="schedule-page__axis"
          style={{ gridRow: `${hour * 2 + 1} / span 2` }}
        >
          {hourLabel(hour)}
        </span>
      ))}
      {days.map((date, dayIndex) => (
        <div
          key={date}
          className="schedule-page__day-col"
          style={{ gridColumn: dayIndex + 2 }}
        >
          {segments.filter((segment) => segment.date === date).map((segment) => {
            const rangeLabel = timedEventRangeLabel(segment.event)
            const laneStyle = {
              gridRow: `${segment.rowStart} / ${segment.rowEnd}`,
              '--timed-lane': String(segment.lane),
              '--timed-lanes': String(segment.laneCount),
            } as CSSProperties
            return (
              <button
                key={`${segment.event.id}-${date}`}
                type="button"
                className={`${eventClassName(segment.event)} schedule-page__block--timed`}
                style={laneStyle}
                title={`${rangeLabel} ${segment.event.title}`.trim()}
                data-row-start={segment.rowStart}
                data-row-end={segment.rowEnd}
                onClick={() => onOpenEvent(segment.event)}
              >
                {rangeLabel ? <span className="schedule-page__block-time">{rangeLabel}</span> : null}
                <span className="schedule-page__block-title">{segment.event.title}</span>
              </button>
            )
          })}
        </div>
      ))}
      {nowLine ? (
        <div
          className="schedule-page__now"
          style={{ top: `${nowLine.topPercent}%` }}
          data-testid="schedule-now-line"
          data-minute={nowLine.minute}
          data-date={nowLine.date}
        >
          <span className="schedule-page__now-dot" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  )
}
