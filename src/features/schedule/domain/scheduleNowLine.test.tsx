import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScheduleWeekTimeGrid } from '../components/ScheduleWeekTimeGrid'
import { weekDays } from './scheduleRange'
import { currentTimeLinePlacement, msUntilNextMinute } from './scheduleNowLine'

const THIS_WEEK = weekDays('2026-11-11')
const OTHER_WEEK = weekDays('2026-11-01')

function at(hm: string, date = '2026-11-11'): Date {
  return new Date(`${date}T${hm}:00+09:00`)
}

describe('주간 현재 시각 선', () => {
  it('11:23 과 11:24 는 분 단위로 다른 높이다', () => {
    const at23 = currentTimeLinePlacement(at('11:23'), THIS_WEEK)
    const at24 = currentTimeLinePlacement(at('11:24'), THIS_WEEK)
    expect(at23).toMatchObject({ date: '2026-11-11', minute: 11 * 60 + 23 })
    expect(at24).toMatchObject({ date: '2026-11-11', minute: 11 * 60 + 24 })
    expect(at23?.topPercent).toBeCloseTo(((11 * 60 + 23) / 1440) * 100, 5)
    expect(at24?.topPercent).toBeCloseTo(((11 * 60 + 24) / 1440) * 100, 5)
    expect(at24!.topPercent).toBeGreaterThan(at23!.topPercent)
  })

  it('오늘이 보이는 주가 아니면 선을 그리지 않는다', () => {
    expect(currentTimeLinePlacement(at('11:23'), OTHER_WEEK)).toBeNull()
    expect(THIS_WEEK).toContain('2026-11-11')
    expect(OTHER_WEEK).not.toContain('2026-11-11')
  })

  it('다음 갱신은 다음 분 경계다', () => {
    expect(msUntilNextMinute(new Date('2026-11-11T11:23:00+09:00'))).toBe(60_000)
    expect(msUntilNextMinute(new Date('2026-11-11T11:23:40.250+09:00'))).toBe(19_750)
  })

  it('그리드에 11:23 선이 있고 11:24 로 바뀌면 위치가 달라진다', () => {
    const renderAt = (hm: string) => renderToStaticMarkup(
      <ScheduleWeekTimeGrid
        days={THIS_WEEK}
        events={[]}
        now={at(hm)}
        onOpenEvent={() => undefined}
        eventClassName={() => 'schedule-page__block'}
      />,
    )
    const at23 = renderAt('11:23')
    const at24 = renderAt('11:24')
    expect(at23).toContain('data-testid="schedule-now-line"')
    expect(at23).toContain('data-minute="683"')
    expect(at24).toContain('data-minute="684"')
    expect(at23).not.toBe(at24)
    const other = renderToStaticMarkup(
      <ScheduleWeekTimeGrid
        days={OTHER_WEEK}
        events={[]}
        now={at('11:23')}
        onOpenEvent={() => undefined}
        eventClassName={() => 'schedule-page__block'}
      />,
    )
    expect(other).not.toContain('schedule-now-line')
  })

  it('30분 칸 높이는 40px(이전 30px의 약 1.33배)이다', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../schedule-page.css')
    const css = readFileSync(cssPath, 'utf8')
    expect(css).toMatch(/--schedule-week-slot:\s*40px/)
    expect(css).toMatch(/\.schedule-page__week-head,\s*\.schedule-page__all-day,\s*\.schedule-page__hours\s*\{\s*scrollbar-gutter:\s*stable;/)
  })
})
