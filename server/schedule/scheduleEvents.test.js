import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dayRangeYmd, monthGridRangeYmd, weekRangeYmd } from '../lib/seoulCalendarDate.js'
import { assembleReminderEvents } from '../reminders/reminderEvents.js'
import {
  eventOverlapsRange,
  filterScheduleBySources,
  mergeScheduleEvents,
  normalizeGoogleCalendarEvent,
  normalizeReminderScheduleEvent,
  parseScheduleSources,
  safeGoogleHtmlLink,
  scheduleEventEndYmd,
  scheduleEventStartYmd,
  scheduleFilterKey,
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
  it('상령일·자동차 만기·알림일을 하나의 일정 모델(source=crm)로 맞춘다', () => {
    const events = reminders()
    const age = events.find((event) => event.type === 'insurance_age')
    const car = events.find((event) => event.type === 'car_expiry')
    const alert = events.find((event) => event.type === 'customer_alert')
    for (const event of events) {
      assert.equal(event.source, 'crm')
      assert.equal(event.timezone, 'Asia/Seoul')
      assert.equal(event.calendarId, null)
      assert.equal(typeof event.readOnly, 'boolean')
      assert.equal(event.location, '')
    }
    assert.equal(age.allDay, true)
    assert.equal(age.startAt, '2026-10-15')
    assert.equal(age.endAt, '2026-10-16')
    assert.equal(age.readOnly, true)
    assert.equal(alert.readOnly, false)
    assert.equal(age.customerName, '홍길동')
    assert.equal(car.sourceId, '9')
    assert.equal(car.customerId, 1)
    assert.equal(alert.sourceId, '4')
    assert.equal(alert.startAt, '2026-10-20')
    assert.equal(alert.sourceDate, '1990-10-20')
    assert.equal(alert.sourceTitle, '건강검진')
    assert.notEqual(alert.title, alert.sourceTitle)
    assert.equal(alert.description.includes('건강검진'), true)
  })

  it('Google 종일·시간 일정을 공통 모델로 바꾸고 원본 필드는 넘기지 않는다', () => {
    const allDay = normalizeGoogleCalendarEvent({
      id: 'g1',
      status: 'confirmed',
      summary: '본사 미팅',
      etag: '"etag-1"',
      location: '서울 본사',
      description: '<b>안건</b><br>보고',
      htmlLink: 'https://www.google.com/calendar/event?eid=g1',
      creator: { email: 'someone@example.com' },
      start: { date: '2026-10-15' },
      end: { date: '2026-10-16' },
    }, { id: 'team@group.calendar.google.com', name: '팀', timezone: 'Asia/Seoul' })
    assert.equal(allDay.id, 'google:team@group.calendar.google.com:g1')
    assert.equal(allDay.source, 'google')
    assert.equal(allDay.type, 'google_event')
    assert.equal(allDay.calendarId, 'team@group.calendar.google.com')
    assert.equal(allDay.calendarName, '팀')
    assert.equal(allDay.allDay, true)
    assert.equal(allDay.readOnly, true)
    assert.equal(allDay.location, '서울 본사')
    assert.equal(allDay.description, '안건\n보고')
    assert.equal(allDay.htmlLink, 'https://www.google.com/calendar/event?eid=g1')
    assert.equal('etag' in allDay, false)
    assert.equal('creator' in allDay, false)
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
    assert.equal(normalizeGoogleCalendarEvent({ id: 'bad', start: { dateTime: 'not-a-date' } }), null)
  })

  it('htmlLink 는 https Google Calendar 주소만 남긴다', () => {
    assert.equal(safeGoogleHtmlLink('https://calendar.google.com/calendar/event?eid=x'), 'https://calendar.google.com/calendar/event?eid=x')
    assert.equal(safeGoogleHtmlLink('https://www.google.com/calendar/event?eid=x'), 'https://www.google.com/calendar/event?eid=x')
    assert.equal(safeGoogleHtmlLink('javascript:alert(1)'), null)
    assert.equal(safeGoogleHtmlLink('http://www.google.com/calendar/event?eid=x'), null)
    assert.equal(safeGoogleHtmlLink('https://www.google.com.evil.example/calendar'), null)
    assert.equal(safeGoogleHtmlLink('https://www.google.com/search?q=x'), null)
    assert.equal(safeGoogleHtmlLink(''), null)
  })
})

describe('schedule timezone and all-day rules (Asia/Seoul)', () => {
  it('종일 일정은 UTC 자정으로 바꾸지 않아 하루 밀리지 않는다', () => {
    const event = normalizeGoogleCalendarEvent({ id: 'a', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } })
    assert.equal(event.startAt, '2026-10-01')
    assert.equal(scheduleEventStartYmd(event), '2026-10-01')
    assert.equal(scheduleEventEndYmd(event), '2026-10-01')
    const multi = normalizeGoogleCalendarEvent({ id: 'b', start: { date: '2026-10-30' }, end: { date: '2026-11-02' } })
    assert.equal(scheduleEventEndYmd(multi), '2026-11-01')
    assert.equal(eventOverlapsRange(multi, '2026-11-01', '2026-11-30'), true)
    assert.equal(eventOverlapsRange(multi, '2026-11-02', '2026-11-30'), false)
  })

  it('서울 09:00 일정과 자정 전후 일정의 날짜', () => {
    const nine = normalizeGoogleCalendarEvent({ id: 'n', start: { dateTime: '2026-10-02T09:00:00+09:00' }, end: { dateTime: '2026-10-02T10:00:00+09:00' } })
    assert.equal(scheduleEventStartYmd(nine), '2026-10-02')
    const beforeMidnight = normalizeGoogleCalendarEvent({ id: 'm1', start: { dateTime: '2026-10-02T23:30:00+09:00' }, end: { dateTime: '2026-10-03T00:00:00+09:00' } })
    assert.equal(scheduleEventStartYmd(beforeMidnight), '2026-10-02')
    assert.equal(scheduleEventEndYmd(beforeMidnight), '2026-10-02')
    const afterMidnightUtc = normalizeGoogleCalendarEvent({ id: 'm2', start: { dateTime: '2026-10-02T15:10:00Z' }, end: { dateTime: '2026-10-02T15:40:00Z' } })
    assert.equal(scheduleEventStartYmd(afterMidnightUtc), '2026-10-03')
  })

  it('월 경계: 10월 31일 23시 일정은 10월, 11월 1일 00시 일정은 11월', () => {
    const oct = normalizeGoogleCalendarEvent({ id: 'o', start: { dateTime: '2026-10-31T23:00:00+09:00' }, end: { dateTime: '2026-10-31T23:30:00+09:00' } })
    const nov = normalizeGoogleCalendarEvent({ id: 'v', start: { dateTime: '2026-11-01T00:00:00+09:00' }, end: { dateTime: '2026-11-01T00:30:00+09:00' } })
    assert.equal(eventOverlapsRange(oct, '2026-10-01', '2026-10-31'), true)
    assert.equal(eventOverlapsRange(oct, '2026-11-01', '2026-11-30'), false)
    assert.equal(eventOverlapsRange(nov, '2026-10-01', '2026-10-31'), false)
    assert.equal(eventOverlapsRange(nov, '2026-11-01', '2026-11-30'), true)
  })

  it('DST 시간대 캘린더(America/New_York) 일정은 실제 시각 기준 서울 날짜로', () => {
    // 2026-11-01 01:30 EST(-05:00, DST 종료 후) = 서울 15:30 같은 날
    const ny = normalizeGoogleCalendarEvent({
      id: 'ny',
      start: { dateTime: '2026-11-01T01:30:00-05:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-11-01T02:30:00-05:00', timeZone: 'America/New_York' },
    }, { id: 'ny-cal', timezone: 'America/New_York' })
    assert.equal(ny.timezone, 'America/New_York')
    assert.equal(scheduleEventStartYmd(ny), '2026-11-01')
    // 2026-03-07 20:00 EST = 서울 03-08 10:00
    const beforeDst = normalizeGoogleCalendarEvent({ id: 'ny2', start: { dateTime: '2026-03-07T20:00:00-05:00' }, end: { dateTime: '2026-03-07T21:00:00-05:00' } })
    assert.equal(scheduleEventStartYmd(beforeDst), '2026-03-08')
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
    assert.deepEqual(onlyAge.map((event) => event.type), ['insurance_age'])
    const onlyGoogle = filterScheduleBySources(merged, parseScheduleSources('google'))
    assert.deepEqual(onlyGoogle.map((event) => scheduleFilterKey(event)), ['google'])
    assert.deepEqual(parseScheduleSources('all'), ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'])
    assert.deepEqual(parseScheduleSources('google_task,onefc_todo'), ['google_task', 'onefc_todo'])
    assert.throws(() => parseScheduleSources('naver'), /invalid_source/)
    assert.throws(() => parseScheduleSources('personal'), /invalid_source/)
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
