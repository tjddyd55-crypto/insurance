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
  return { allDay: true, startTime: DEFAULT_SCHEDULE_START_TIME, endTime: DEFAULT_SCHEDULE_END_TIME }
}

function isHm(value: string): boolean {
  return HM.test(value)
}

/** 같은 날 안에서 시작보다 뒤인 끝 시각. 23시대는 23:59. */
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

/** 저장된 시간 일정은 시간 지정이 켜진 채 그 시각을 연다. 종일은 끈 상태다. */
export function editScheduleTimeFields(event: { allDay: boolean; startTime: string; endTime: string }): ScheduleTimeFields {
  if (event.allDay) return createScheduleTimeFields()
  return setScheduleTimeSpecified(
    { allDay: true, startTime: event.startTime, endTime: event.endTime },
    true,
  )
}

/** 종일 ↔ 시간 지정. 현재 종일이면 시간을 켜고, 시간 일정이면 끈다. */
export function toggleScheduleTimeSpecified(fields: ScheduleTimeFields): ScheduleTimeFields {
  return setScheduleTimeSpecified(fields, fields.allDay)
}

export function scheduleEventWriteTimes(fields: ScheduleTimeFields): ScheduleTimeWrite {
  if (fields.allDay) return { allDay: true, startTime: null, endTime: null }
  return { allDay: false, startTime: fields.startTime, endTime: fields.endTime }
}
