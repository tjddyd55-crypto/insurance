/** 일정 추가·수정의 종일 / 시간 지정. 저장 키는 allDay·startTime·endTime 그대로다. */

export const DEFAULT_SCHEDULE_START_TIME = '09:00'
export const DEFAULT_SCHEDULE_END_TIME = '10:00'

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/

export type ScheduleTimeFields = {
  allDay: boolean
  startTime: string
  endTime: string
}

export type ScheduleTimeWrite = {
  allDay: boolean
  startTime: string | null
  endTime: string | null
}

export function createScheduleTimeFields(): ScheduleTimeFields {
  return {
    allDay: true,
    startTime: DEFAULT_SCHEDULE_START_TIME,
    endTime: sensibleEndTime(DEFAULT_SCHEDULE_START_TIME),
  }
}

function isHm(value: string): boolean {
  return HM.test(value)
}

/**
 * 자동 종료시각의 단일 계산.
 * 00:00–22:59 는 같은 날 +1시간, 23:00–23:59 는 23:59.
 * 다음 날 00:xx 로 넘기지 않고 endDate 도 움직이지 않는다.
 */
export function sensibleEndTime(startTime: string): string {
  const match = HM.exec(startTime)
  if (!match) return DEFAULT_SCHEDULE_END_TIME
  const hour = Number(match[1])
  if (hour >= 23) return '23:59'
  return `${String(hour + 1).padStart(2, '0')}:${match[2]}`
}

export function setScheduleTimeSpecified(fields: ScheduleTimeFields, specified: boolean): ScheduleTimeFields {
  if (!specified) return { ...fields, allDay: true }
  const startTime = isHm(fields.startTime) ? fields.startTime : DEFAULT_SCHEDULE_START_TIME
  const endTime = isHm(fields.endTime) && fields.endTime > startTime ? fields.endTime : sensibleEndTime(startTime)
  return { allDay: false, startTime, endTime }
}

/**
 * 저장된 시간 일정은 그 시각 그대로 연다. 자정을 넘는 23:30→다음날 00:30 도 열기만으로 고치지 않는다.
 * 종일은 시간 지정이 꺼진 상태다.
 */
export function editScheduleTimeFields(event: { allDay: boolean; startTime: string; endTime: string }): ScheduleTimeFields {
  if (event.allDay) return createScheduleTimeFields()
  return { allDay: false, startTime: event.startTime, endTime: event.endTime }
}

/** 종일 ↔ 시간 지정. 현재 종일이면 시간을 켜고, 시간 일정이면 끈다. */
export function toggleScheduleTimeSpecified(fields: ScheduleTimeFields): ScheduleTimeFields {
  return setScheduleTimeSpecified(fields, fields.allDay)
}

export function withScheduleStartTime(fields: ScheduleTimeFields, startTime: string): ScheduleTimeFields {
  return setScheduleTimeSpecified({ ...fields, allDay: false, startTime }, true)
}

export function withScheduleEndTime(fields: ScheduleTimeFields, endTime: string): ScheduleTimeFields {
  return setScheduleTimeSpecified({ ...fields, allDay: false, endTime }, true)
}

function crossesMidnight(date: string | undefined, endDate: string | undefined): boolean {
  return Boolean(date && endDate && endDate > date)
}

export function scheduleEventWriteTimes(fields: ScheduleTimeFields & { date?: string; endDate?: string }): ScheduleTimeWrite {
  if (fields.allDay) return { allDay: true, startTime: null, endTime: null }
  if (crossesMidnight(fields.date, fields.endDate)) {
    return { allDay: false, startTime: fields.startTime, endTime: fields.endTime }
  }
  const fixed = setScheduleTimeSpecified(fields, true)
  return { allDay: false, startTime: fixed.startTime, endTime: fixed.endTime }
}

export function buildScheduleEventInput(form: {
  calendarId: string
  title: string
  description: string
  date: string
  endDate: string
} & ScheduleTimeFields) {
  return {
    calendarId: form.calendarId,
    title: form.title,
    description: form.description,
    date: form.date,
    endDate: form.endDate || form.date,
    ...scheduleEventWriteTimes(form),
  }
}
