import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  annualOccurrences,
  assembleReminderEvents,
  countReminderEventsByDay,
  filterReminderEvents,
  sortReminderEvents,
} from './reminderEvents.js'

const range = { fromYmd: '2026-10-01', toYmd: '2026-10-31' }

function sample() {
  return assembleReminderEvents({
    ...range,
    ageRows: [
      {
        customer_id: 1,
        customer_name: '홍길동',
        phone: '010-1111-2222',
        event_date: '2026-10-15',
        assignee_name: '김담당',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ],
    carRows: [
      {
        customer_id: 1,
        customer_name: '홍길동',
        phone: '010-1111-2222',
        car_id: 9,
        car_number: '12가3456',
        event_date: '2026-10-15',
        assignee_name: '김담당',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    specialRows: [
      {
        special_date_id: 4,
        customer_id: 2,
        customer_name: '이몽룡',
        phone: '01099998888',
        title: '건강검진',
        memo: '오전 예약',
        date_value: '1990-10-20',
        assignee_name: '김담당',
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ],
  })
}

describe('reminder calendar aggregation', () => {
  it('상령일·자동차 만기·매년 알림일을 한 모델로 모은다', () => {
    const events = sample()
    assert.deepEqual(
      events.map((event) => event.type),
      ['insurance_age_date', 'car_expiry', 'special_date'],
    )
    const special = events.find((event) => event.type === 'special_date')
    assert.equal(special.startDate, '2026-10-20')
    assert.equal(special.sourceDate, '1990-10-20')
    assert.equal(special.sourceTitle, '건강검진')
    assert.equal(special.source, 'customer_special_dates')
    assert.equal(special.title, '이몽룡 · 건강검진')
    const car = events.find((event) => event.type === 'car_expiry')
    assert.equal(car.title.includes('홍길동'), true)
    assert.equal(car.title.includes('자동차 만기'), true)
  })

  it('달력 날짜별 건수와 유형 배지를 만든다', () => {
    const days = countReminderEventsByDay(sample())
    const fifteenth = days.find((day) => day.date === '2026-10-15')
    assert.equal(fifteenth.count, 2)
    assert.deepEqual(fifteenth.types.sort(), ['car_expiry', 'insurance_age_date'])
  })

  it('2월 29일은 평년에 만들지 않는다', () => {
    assert.deepEqual(annualOccurrences('2024-02-29', '2025-01-01', '2025-12-31'), [])
    assert.deepEqual(annualOccurrences('2024-02-29', '2024-02-01', '2024-02-29'), ['2024-02-29'])
  })
})

describe('reminder list filters and sort', () => {
  it('유형·기간·이름/전화/내용으로 거른다', () => {
    const events = sample()
    const byType = filterReminderEvents(events, { type: 'car_expiry' })
    assert.equal(byType.length, 1)
    assert.equal(byType[0].type, 'car_expiry')

    const byPhone = filterReminderEvents(events, { query: '9999' })
    assert.equal(byPhone.length, 1)
    assert.equal(byPhone[0].customerName, '이몽룡')

    const byContent = filterReminderEvents(events, { query: '오전' })
    assert.equal(byContent[0].type, 'special_date')

    const outside = filterReminderEvents(events, { fromYmd: '2026-11-01', toYmd: '2026-11-30' })
    assert.equal(outside.length, 0)
  })

  it('빠른 순·늦은 순·고객명·최근 등록순으로 정렬한다', () => {
    const events = sample()
    assert.equal(sortReminderEvents(events, 'soon')[0].startDate, '2026-10-15')
    assert.equal(sortReminderEvents(events, 'late')[0].startDate, '2026-10-20')
    assert.equal(sortReminderEvents(events, 'name')[0].customerName, '이몽룡')
    assert.equal(sortReminderEvents(events, 'created')[0].customerName, '이몽룡')
  })
})
