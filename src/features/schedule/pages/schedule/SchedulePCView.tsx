import { useLayoutEffect, useRef } from 'react'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleBody from './ScheduleBody'

/**
 * PC(≥769px) 일정 관리. 상단 툴바를 압축하고 달력이 남은 화면 높이를 채운다.
 * 페이지 시작 위치(상단 메뉴 높이)를 재서 CSS 변수로 넘긴다. 레이아웃 전용.
 */
export default function SchedulePCView(props: ScheduleViewProps) {
  const ref = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const update = () => {
      const top = Math.max(0, Math.round(el.getBoundingClientRect().top + (el.parentElement?.scrollTop ?? 0)))
      el.style.setProperty('--schedule-pc-top', `${top}px`)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return (
    <main ref={ref} className="page schedule-page schedule-page--pc schedule-page--compact page--with-back">
      <ScheduleBody {...props} calendarDecor compact />
    </main>
  )
}
