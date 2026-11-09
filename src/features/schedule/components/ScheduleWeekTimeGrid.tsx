/* eslint-disable no-restricted-syntax -- 주간 시간 블록은 버튼 모양이 아닌 달력 칸이라 native button 을 쓴다(ScheduleBoards 와 같은 방식). */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ScheduleEvent } from '../api/scheduleApi'
import { currentTimeLinePlacement, msUntilNextMinute } from '../domain/scheduleNowLine'
import { canDragTimedEvent, canResizeTimedEvent, eventWithTimedRange, type TimedRange } from '../domain/scheduleWeekDrag'
import { timedEventRangeLabel, WEEK_SLOTS_PER_DAY, weekTimedSegments } from '../domain/scheduleWeekTimedLayout'
import { useTimedBlockGesture } from '../hooks/useTimedBlockGesture'

import { scheduleItemCssVariables } from '../scheduleItemColors'

const HOURS = Array.from({ length: 24 }, (_, index) => index)

type Props = {
  days: string[]
  events: ScheduleEvent[]
  onOpenEvent: (event: ScheduleEvent) => void
  eventClassName: (event: ScheduleEvent) => string
  /** 테스트용 고정 시각. 없으면 서울 현재 시각을 분마다 갱신한다. */
  now?: Date
  /** 마우스·트랙패드에서만 이동·리사이즈. 터치는 스크롤을 위해 끈다. */
  dragEnabled?: boolean
  onCommitRange?: (event: ScheduleEvent, range: TimedRange) => void
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
 * 주간 시간 축. 일정은 30분 행으로 시작~종료를 채운다.
 * 미세 포인터에서만 블록을 옮기거나 길이를 바꾼다.
 */
export function ScheduleWeekTimeGrid({ days, events, onOpenEvent, eventClassName, now, dragEnabled = false, onCommitRange }: Props) {
  const clock = useScheduleClock(now)
  const nowLine = currentTimeLinePlacement(clock, days)
  const gridRef = useRef<HTMLDivElement>(null)
  const gesture = useTimedBlockGesture(gridRef, dragEnabled, onCommitRange)
  const shown = events.map((event) => (gesture.preview && event.id === gesture.preview.id ? eventWithTimedRange(event, gesture.preview.range) : event))
  const segments = weekTimedSegments(shown, days)
  const gridStyle = { '--schedule-week-slots': String(WEEK_SLOTS_PER_DAY) } as CSSProperties

  return (
    <div
      ref={gridRef}
      className={gesture.dragging ? 'schedule-page__time-grid schedule-page__time-grid--dragging' : 'schedule-page__time-grid'}
      style={gridStyle}
    >
      {HOURS.map((hour) => (
        <span key={hour} className="schedule-page__axis" style={{ gridRow: `${hour * 2 + 1} / span 2` }}>
          {hourLabel(hour)}
        </span>
      ))}
      {days.map((date, dayIndex) => (
        <div key={date} className="schedule-page__day-col" style={{ gridColumn: dayIndex + 2 }}>
          {segments.filter((segment) => segment.date === date).map((segment) => {
            const rangeLabel = timedEventRangeLabel(segment.event)
            const draggable = dragEnabled && canDragTimedEvent(segment.event)
            const resizable = draggable && canResizeTimedEvent(segment.event)
            const laneStyle = {
              ...scheduleItemCssVariables(segment.event),
              gridRow: `${segment.rowStart} / ${segment.rowEnd}`,
              '--timed-lane': String(segment.lane),
              '--timed-lanes': String(segment.laneCount),
            } as CSSProperties
            return (
              <button
                key={`${segment.event.id}-${date}`}
                type="button"
                className={`${eventClassName(segment.event)} schedule-page__block--timed${draggable ? ' schedule-page__block--draggable' : ''}`}
                style={laneStyle}
                title={`${rangeLabel} ${segment.event.title}`.trim()}
                data-row-start={segment.rowStart}
                data-row-end={segment.rowEnd}
                data-draggable={draggable ? 'true' : 'false'}
                data-resizable={resizable ? 'true' : 'false'}
                onPointerDown={(pointer) => gesture.begin(pointer, segment.event, 'pending')}
                onClick={() => {
                  if (gesture.consumeClick()) return
                  onOpenEvent(segment.event)
                }}
              >
                {resizable ? (
                  <span
                    className="schedule-page__resize-handle schedule-page__resize-handle--start"
                    data-testid="schedule-resize-start"
                    onPointerDown={(pointer) => gesture.begin(pointer, segment.event, 'resize-start')}
                  />
                ) : null}
                {rangeLabel ? <span className="schedule-page__block-time">{rangeLabel}</span> : null}
                <span className="schedule-page__block-title">{segment.event.title}</span>
                {resizable ? (
                  <span
                    className="schedule-page__resize-handle schedule-page__resize-handle--end"
                    data-testid="schedule-resize-end"
                    onPointerDown={(pointer) => gesture.begin(pointer, segment.event, 'resize-end')}
                  />
                ) : null}
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
