import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dayRangeYmd, monthGridRangeYmd, weekRangeYmd } from '../lib/seoulCalendarDate.js'
import { assembleReminderEvents } from '../reminders/reminderEvents.js'
import {
  eventOverlapsRange,
  filterScheduleBySources,
  mergeScheduleEvents,
  normalizeGoogleCalendarEvent,
  normalizePersonalTodo,
  normalizeReminderScheduleEvent,
  parseScheduleSources,
  scheduleEventStartYmd,
} from './scheduleEvents.js'

function reminders() {
  return assembleReminderEvents({
    fromYmd: '2026-10-01',
    toYmd: '2026-10-31',
    ageRows: [{
      customer_id: 1,
      customer_name: '홍길동',
      phone: '010-1111-2222',
      event_date: '2026-10-15',
      assignee_name: '김담당',
    }],
    carRows: [{
      customer_id: 1,
      customer_name: '홍길동',
      phone: '010-1111-2222',
      car_id: 9,
      car_number: '12가3456',
      event_date: '2026-10-15',
      assignee_name: '김담당',
    }],
    specialRows: [{
      special_date_id: 4,
      customer_id: 2,
      customer_name: '이몽룡',
      phone: '01099998888',
      title: '건강검진',
      memo: '오전',
      date_value: '1990-10-20',
      assignee_name: '김담당',
    }],
  }).map((event) => normalizeReminderScheduleEvent(event))
}

describe('schedule event normalize', () => {
  it('상령일·자동차 만기·고객 알림을 하나의 일정 모델로 맞춘다', () => {
    const events = reminders()
    const age = events.find((event) => event.source === 'insurance_age')
    const car = events.find((event) => event.source === 'car_expiry')
    const alert = events.find((event) => event.source === 'customer_alert')
    assert.equal(age.allDay, true)
    assert.equal(age.startAt, '2026-10-15')
    assert.equal(age.customerName, '홍길동')
    assert.equal(age.type, 'insurance_age_date')
    assert.equal(car.sourceId, '9')
    assert.equal(car.customerId, 1)
    assert.equal(alert.sourceId, '4')
    assert.equal(alert.startAt, '2026-10-20')
    assert.equal(alert.sourceDate, '1990-10-20')
    assert.equal(alert.sourceTitle, '건강검진')
    assert.notEqual(alert.title, alert.sourceTitle)
    assert.equal(alert.description.includes('건강검진'), true)
  })

  it('Google 종일·시간 일정과 etag, htmlLink 를 남긴다', () => {
    const allDay = normalizeGoogleCalendarEvent({
      id: 'g1',
      status: 'confirmed',
      summary: '본사 미팅',
      etag: '"etag-1"',
      htmlLink: 'https://calendar.google.com/event?eid=g1',
      start: { date: '2026-10-15' },
      end: { date: '2026-10-16' },
    })
    assert.equal(allDay.id, 'google:primary:g1')
    assert.equal(allDay.allDay, true)
    assert.equal(allDay.sourceId, 'g1')
    assert.equal(allDay.etag, '"etag-1"')
    assert.equal(allDay.htmlLink.includes('calendar.google.com'), true)
    assert.equal(scheduleEventStartYmd(allDay), '2026-10-15')
    assert.equal(eventOverlapsRange(allDay, '2026-10-16', '2026-10-16'), false)

    const timed = normalizeGoogleCalendarEvent({
      id: 'g2',
      summary: '밤 회의',
      start: { dateTime: '2026-10-15T15:30:00Z' },
      end: { dateTime: '2026-10-15T16:00:00Z' },
    })
    assert.equal(timed.allDay, false)
    assert.equal(scheduleEventStartYmd(timed), '2026-10-16')
    assert.equal(normalizeGoogleCalendarEvent({ id: 'gone', status: 'cancelled', start: { date: '2026-10-01' } }), null)
  })

  it('개인 할일은 시간이 없으면 종일이고 취소는 버린다', () => {
    const todo = normalizePersonalTodo({
      id: 7,
      title: '청약 서류',
      description: '스캔',
      due_date: '2026-10-15',
      due_time: '09:30:00',
      status: 'pending',
    })
    assert.equal(todo.source, 'personal')
    assert.equal(todo.allDay, false)
    assert.equal(todo.startAt, '2026-10-15T09:30:00+09:00')
    assert.equal(scheduleEventStartYmd(todo), '2026-10-15')
    assert.equal(normalizePersonalTodo({ id: 8, title: '취소', due_date: '2026-10-15', status: 'canceled' }), null)
  })
})

describe('schedule query rules', () => {
  it('출처 필터와 중복 id 를 제거한다', () => {
    const [age, car, alert] = reminders()
    const google = normalizeGoogleCalendarEvent({
      id: 'g1',
      summary: '본사',
      start: { date: '2026-10-15' },
      end: { date: '2026-10-16' },
    })
    const merged = mergeScheduleEvents([[age, car, alert, google], [age, google]])
    assert.equal(merged.length, 4)
    const onlyAge = filterScheduleBySources(merged, parseScheduleSources('insurance_age'))
    assert.deepEqual(onlyAge.map((event) => event.source), ['insurance_age'])
    assert.deepEqual(parseScheduleSources('all').length, 5)
    assert.throws(() => parseScheduleSources('naver'), /invalid_source/)
  })

  it('월간·주간·일간 구간을 KST 달력으로 계산한다', () => {
    const month = monthGridRangeYmd(2026, 10)
    assert.equal(month.monthStart, '2026-10-01')
    assert.equal(month.monthEnd, '2026-10-31')
    assert.equal(month.start, '2026-09-27')
    assert.equal(month.end, '2026-11-07')
    assert.deepEqual(weekRangeYmd('2026-10-15'), { start: '2026-10-12', end: '2026-10-18' })
    assert.deepEqual(dayRangeYmd('2026-10-15'), { start: '2026-10-15', end: '2026-10-15' })
  })

  it('조회 구간 밖의 일정은 빠진다', () => {
    const [age] = reminders()
    assert.equal(eventOverlapsRange(age, '2026-10-15', '2026-10-15'), true)
    assert.equal(eventOverlapsRange(age, '2026-10-16', '2026-10-20'), false)
  })
})
