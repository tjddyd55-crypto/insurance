import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEvent } from '../api/scheduleApi'
import {
  canDragTimedEvent,
  canResizeTimedEvent,
  dayIndexFromPointer,
  minuteFromPointer,
  moveTimedRange,
  pointerExceededThreshold,
  readTimedRange,
  resizeTimedRange,
  type TimedRange,
} from '../domain/scheduleWeekDrag'

export type GestureMode = 'pending' | 'move' | 'resize-start' | 'resize-end'

type Gesture = {
  pointerId: number
  event: ScheduleEvent
  mode: GestureMode
  originX: number
  originY: number
  originRange: TimedRange
  originDay: number
  originMinute: number
  next: TimedRange | null
}

type WindowListeners = {
  move: (event: PointerEvent) => void
  up: (event: PointerEvent) => void
}

function gridMetrics(grid: HTMLElement) {
  const box = grid.getBoundingClientRect()
  const axis = grid.querySelector<HTMLElement>('.schedule-page__axis')
  return { left: box.left, top: box.top, width: box.width, height: box.height, axisWidth: axis?.getBoundingClientRect().width ?? 0 }
}

function sameRange(left: TimedRange, right: TimedRange): boolean {
  return left.startDate === right.startDate && left.startMinute === right.startMinute
    && left.endDate === right.endDate && left.endMinute === right.endMinute
}

/**
 * 주간 시간 블록의 이동·리사이즈.
 * 임계값 미만은 클릭으로 남기고, 창 리스너로 칸 밖까지 따라간다.
 */
export function useTimedBlockGesture(
  gridRef: { readonly current: HTMLDivElement | null },
  dragEnabled: boolean,
  onCommitRange?: (event: ScheduleEvent, range: TimedRange) => void,
) {
  const gesture = useRef<Gesture | null>(null)
  const listeners = useRef<WindowListeners | null>(null)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState<{ id: string; range: TimedRange } | null>(null)
  const [dragging, setDragging] = useState(false)

  const detach = () => {
    const current = listeners.current
    if (!current) return
    window.removeEventListener('pointermove', current.move)
    window.removeEventListener('pointerup', current.up)
    window.removeEventListener('pointercancel', current.up)
    listeners.current = null
  }

  useEffect(() => detach, [])

  const trackMove = (clientX: number, clientY: number) => {
    const current = gesture.current
    const grid = gridRef.current
    if (!current || !grid) return
    if (current.mode === 'pending' && !pointerExceededThreshold(clientX - current.originX, clientY - current.originY)) return
    if (current.mode === 'pending') current.mode = 'move'
    setDragging(true)
    const metrics = gridMetrics(grid)
    const minute = minuteFromPointer(clientY, metrics.top, metrics.height)
    const range = resizedOrMoved(current, minute, clientX, metrics)
    if (!range) return
    current.next = range
    setPreview({ id: current.event.id, range })
  }

  const finish = (pointerId: number) => {
    const current = gesture.current
    if (!current || current.pointerId !== pointerId) return
    gesture.current = null
    setDragging(false)
    setPreview(null)
    if (current.mode === 'pending') return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    if (current.next && !sameRange(current.next, current.originRange)) onCommitRange?.(current.event, current.next)
  }

  const begin = (pointer: ReactPointerEvent, scheduleEvent: ScheduleEvent, mode: GestureMode) => {
    if (!dragEnabled || !onCommitRange || !canDragTimedEvent(scheduleEvent)) return
    if (mode !== 'pending' && !canResizeTimedEvent(scheduleEvent)) return
    const range = readTimedRange(scheduleEvent)
    const grid = gridRef.current
    if (!range || !grid) return
    pointer.stopPropagation()
    if (mode !== 'pending') pointer.preventDefault()
    detach()
    const metrics = gridMetrics(grid)
    const pointerId = pointer.pointerId
    gesture.current = {
      pointerId,
      event: scheduleEvent,
      mode,
      originX: pointer.clientX,
      originY: pointer.clientY,
      originRange: range,
      originDay: dayIndexFromPointer(pointer.clientX, metrics.left, metrics.axisWidth, metrics.width),
      originMinute: minuteFromPointer(pointer.clientY, metrics.top, metrics.height),
      next: null,
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      trackMove(event.clientX, event.clientY)
      if (gesture.current?.mode !== 'pending' && event.cancelable) event.preventDefault()
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      detach()
      finish(event.pointerId)
    }
    listeners.current = { move, up }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const consumeClick = () => {
    if (!suppressClick.current) return false
    suppressClick.current = false
    return true
  }

  return { preview, dragging, begin, consumeClick }
}

function resizedOrMoved(
  current: Gesture,
  minute: number,
  clientX: number,
  metrics: { left: number; axisWidth: number; width: number },
): TimedRange | null {
  if (current.mode === 'resize-start' || current.mode === 'resize-end') {
    const edge = current.mode === 'resize-start' ? 'start' : 'end'
    return resizeTimedRange(current.originRange, edge, minute)
  }
  const day = dayIndexFromPointer(clientX, metrics.left, metrics.axisWidth, metrics.width)
  return moveTimedRange(current.originRange, day - current.originDay, minute - current.originMinute)
}
