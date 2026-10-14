import { useCallback, useEffect, useRef, useState } from 'react'
import ScheduleChrome from '../../components/ScheduleChrome'
import ScheduleCustomerModal from '../../components/ScheduleCustomerModal'
import { customerTargetOfEvent, customerTargetOfTask, type ScheduleCustomerTarget } from '../../domain/scheduleCustomerTarget'
import type { ScheduleEvent, ScheduleTask } from '../../api/scheduleApi'
import {
  ScheduleDay,
  ScheduleEventDialog,
  ScheduleGoogleDetailDialog,
  ScheduleList,
  ScheduleMonth,
  ScheduleTaskDetailDialog,
  ScheduleWeek,
} from '../../components/ScheduleBoards'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleHolidaySetting, { useScheduleHolidayMode } from '../../components/ScheduleHolidaySetting'

/** 달력 기간(월간 anchor 의 달)에 오늘이 들어 있는가 */
function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/**
 * PC·모바일 웹 공통 본문. calendarDecor(PC)일 때만:
 * 첫 진입 오늘 선택, 칸 빈 곳 클릭 선택, 할 일 출처 표시, 고객 연결 일정 → 고객 상세 팝업.
 * 모바일 웹은 기존 동작 그대로.
 */
export default function ScheduleBody(props: ScheduleViewProps & { calendarDecor?: boolean; compact?: boolean }) {
  const [holidayMode, setHolidayMode] = useScheduleHolidayMode(props.userKey)
  const decorMode = props.calendarDecor ? holidayMode : undefined
  const pc = Boolean(props.calendarDecor)
  // 열린 고객 팝업은 연 계정(owner)과 같이 둔다. 다른 계정으로 바뀌면 바로 닫힌 것으로 본다(계정 분리).
  const [customerOpen, setCustomerOpen] = useState<{ owner: string; target: ScheduleCustomerTarget } | null>(null)
  const customerTarget = customerOpen && customerOpen.owner === (props.userKey ?? '') ? customerOpen.target : null
  const setCustomerTarget = useCallback((target: ScheduleCustomerTarget | null) => {
    setCustomerOpen(target ? { owner: props.userKey ?? '', target } : null)
  }, [props.userKey])
  const autoSelectedRef = useRef(false)
  const { view, anchor, today, selectedDate, onSelectDate } = props

  // PC 첫 진입: 월간에서 오늘이 보이는 달이면 오늘을 실제로 선택한다(아래 날짜 목록이 오늘 항목).
  useEffect(() => {
    if (!pc || autoSelectedRef.current) return
    autoSelectedRef.current = true
    if (view === 'month' && !selectedDate && sameMonth(anchor, today)) onSelectDate(today)
  }, [anchor, onSelectDate, pc, selectedDate, today, view])

  const { onOpenEvent: baseOpenEvent, onOpenTask: baseOpenTask } = props
  const onOpenEvent = useCallback((event: ScheduleEvent) => {
    const target = pc ? customerTargetOfEvent(event) : null
    if (target) setCustomerTarget(target)
    else baseOpenEvent(event)
  }, [baseOpenEvent, pc, setCustomerTarget])
  const onOpenTask = useCallback((task: ScheduleTask) => {
    const target = pc ? customerTargetOfTask(task) : null
    if (target) setCustomerTarget(target)
    else baseOpenTask(task)
  }, [baseOpenTask, pc, setCustomerTarget])
  return (
    <>
      <ScheduleChrome
        {...props}
        toolbarExtra={props.compact && props.calendarDecor && (props.view === 'month' || props.view === 'week')
          ? <ScheduleHolidaySetting mode={holidayMode} onChange={setHolidayMode} />
          : undefined}
      />
      {!props.compact && props.calendarDecor && (props.view === 'month' || props.view === 'week') ? (
        <ScheduleHolidaySetting mode={holidayMode} onChange={setHolidayMode} />
      ) : null}
      {props.view === 'month' ? (
        <ScheduleMonth
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          selectedDate={props.selectedDate}
          onSelectDate={props.onSelectDate}
          onOpenDay={props.onOpenDay}
          onOpenEvent={onOpenEvent}
          onOpenTask={onOpenTask}
          holidayMode={decorMode}
          pcCell={pc}
        />
      ) : null}
      {props.view === 'week' ? (
        <ScheduleWeek
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={onOpenEvent}
          onOpenTask={onOpenTask}
          holidayMode={decorMode}
          pcCell={pc}
        />
      ) : null}
      {props.view === 'day' ? (
        <ScheduleDay
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={onOpenEvent}
          onOpenTask={onOpenTask}
        />
      ) : null}
      {props.view === 'list' ? (
        <ScheduleList
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={onOpenEvent}
          onOpenTask={onOpenTask}
          monthOnly={pc}
          includeOverdue={pc && props.includeOverdue}
        />
      ) : null}
      <ScheduleGoogleDetailDialog detail={props.detail} onCloseDetail={props.onCloseDetail} />
      <ScheduleTaskDetailDialog
        taskDetail={props.taskDetail}
        today={props.today}
        onCloseTaskDetail={props.onCloseTaskDetail}
        onOpenTodos={props.onOpenTodos}
      />
      <ScheduleEventDialog {...props} />
      {pc ? <ScheduleCustomerModal token={props.token} target={customerTarget} onClose={() => setCustomerTarget(null)} /> : null}
    </>
  )
}
