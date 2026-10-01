import { REMINDER_TYPE_LABEL, type ReminderDayCount, type ReminderEvent } from '../api/reminderApi'

function monthCells(month: string): Array<{ date: string; inMonth: boolean }> {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const startWeekday = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const cells: Array<{ date: string; inMonth: boolean }> = []
  for (let index = 0; index < startWeekday; index += 1) {
    cells.push({ date: `pad-${index}`, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${yearText}-${monthText}-${String(day).padStart(2, '0')}`
    cells.push({ date, inMonth: true })
  }
  return cells
}

function formatHeading(date: string, count: number): string {
  const [year, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일 · ${count}건`
}

export default function ReminderCalendarPanel({
  month,
  selectedDay,
  days,
  dayEvents,
  loading,
  onShiftMonth,
  onSelectDay,
  onOpenCustomer,
}: {
  month: string
  selectedDay: string
  days: ReminderDayCount[]
  dayEvents: ReminderEvent[]
  loading: boolean
  onShiftMonth: (delta: number) => void
  onSelectDay: (date: string) => void
  onOpenCustomer: (event: ReminderEvent) => void
}) {
  const counts = new Map(days.map((day) => [day.date, day]))
  const [yearText, monthText] = month.split('-')
  return (
    <section className="notification-hub__calendar" aria-label="알림 달력">
      <div className="notification-hub__calendar-nav">
        <button type="button" onClick={() => onShiftMonth(-1)} aria-label="이전 달">이전</button>
        <strong>{yearText}년 {Number(monthText)}월</strong>
        <button type="button" onClick={() => onShiftMonth(1)} aria-label="다음 달">다음</button>
      </div>
      {loading ? <p>달력을 불러오는 중…</p> : null}
      <div className="notification-hub__calendar-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((label) => (
          <span key={label} className="notification-hub__weekday">{label}</span>
        ))}
        {monthCells(month).map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.date} className="notification-hub__day notification-hub__day--pad" />
          }
          const summary = counts.get(cell.date)
          const selected = cell.date === selectedDay
          return (
            <button
              key={cell.date}
              type="button"
              className={selected ? 'notification-hub__day notification-hub__day--selected' : 'notification-hub__day'}
              onClick={() => onSelectDay(cell.date)}
            >
              <span>{Number(cell.date.slice(8))}</span>
              {summary ? <em>{summary.count}</em> : null}
              <span className="notification-hub__badges">
                {(summary?.types ?? []).map((type) => (
                  <i key={type}>{REMINDER_TYPE_LABEL[type].slice(0, 2)}</i>
                ))}
              </span>
            </button>
          )
        })}
      </div>
      {selectedDay ? (
        <div className="notification-hub__day-list">
          <h2>{formatHeading(selectedDay, dayEvents.length)}</h2>
          {dayEvents.length === 0 ? <p>이 날짜의 알림이 없습니다.</p> : null}
          <ul>
            {dayEvents.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => onOpenCustomer(event)}>
                  {event.customerName} · {REMINDER_TYPE_LABEL[event.type]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
