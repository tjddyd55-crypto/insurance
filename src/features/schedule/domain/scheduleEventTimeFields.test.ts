import { describe, expect, it } from 'vitest'
import {
  buildScheduleEventInput,
  createScheduleTimeFields,
  editScheduleTimeFields,
  scheduleEventWriteTimes,
  sensibleEndTime,
  setScheduleTimeSpecified,
  toggleScheduleTimeSpecified,
  withScheduleEndTime,
  withScheduleStartTime,
} from './scheduleEventTimeFields'

describe('scheduleEventTimeFields', () => {
  it('opens a new event as all-day and writes null times', () => {
    const created = createScheduleTimeFields()
    expect(created.allDay).toBe(true)
    expect(scheduleEventWriteTimes(created)).toEqual({ allDay: true, startTime: null, endTime: null })
  })

  it('shows 09:00-10:00 when 시간 지정 is turned on, and null times again when turned off', () => {
    const specified = toggleScheduleTimeSpecified(createScheduleTimeFields())
    expect(specified).toMatchObject({ allDay: false, startTime: '09:00', endTime: '10:00' })
    expect(scheduleEventWriteTimes(specified)).toEqual({ allDay: false, startTime: '09:00', endTime: '10:00' })
    const cleared = setScheduleTimeSpecified({ ...specified, startTime: '14:00', endTime: '15:30' }, false)
    expect(cleared.allDay).toBe(true)
    expect(cleared.startTime).toBe('14:00')
    expect(scheduleEventWriteTimes(cleared)).toEqual({ allDay: true, startTime: null, endTime: null })
    expect(setScheduleTimeSpecified(cleared, true)).toMatchObject({ allDay: false, startTime: '14:00', endTime: '15:30' })
  })

  it('keeps a saved clock on edit and leaves all-day events unspecified', () => {
    expect(editScheduleTimeFields({ allDay: false, startTime: '13:10', endTime: '14:00' })).toEqual({
      allDay: false,
      startTime: '13:10',
      endTime: '14:00',
    })
    expect(editScheduleTimeFields({ allDay: true, startTime: '', endTime: '' }).allDay).toBe(true)
    expect(scheduleEventWriteTimes(editScheduleTimeFields({ allDay: true, startTime: '', endTime: '' })).startTime).toBeNull()
  })

  it('moves an end time that is not after the start', () => {
    expect(setScheduleTimeSpecified({ allDay: true, startTime: '18:15', endTime: '09:00' }, true)).toMatchObject({
      startTime: '18:15',
      endTime: '19:15',
    })
    expect(setScheduleTimeSpecified({ allDay: true, startTime: '23:40', endTime: '23:40' }, true).endTime).toBe('23:59')
  })

  it('adds one hour through 22:59 and caps 23:00-23:59 at 23:59 on the same day', () => {
    expect(sensibleEndTime('22:30')).toBe('23:30')
    expect(sensibleEndTime('23:00')).toBe('23:59')
    expect(sensibleEndTime('23:30')).toBe('23:59')
    expect(sensibleEndTime('23:59')).toBe('23:59')
    const base = { allDay: false, startTime: '09:00', endTime: '10:00' }
    expect(withScheduleStartTime(base, '22:30')).toMatchObject({ startTime: '22:30', endTime: '23:30' })
    expect(withScheduleStartTime(base, '23:00')).toMatchObject({ startTime: '23:00', endTime: '23:59' })
    expect(withScheduleStartTime(base, '23:30')).toMatchObject({ startTime: '23:30', endTime: '23:59' })
    expect(withScheduleStartTime(base, '23:59')).toMatchObject({ startTime: '23:59', endTime: '23:59' })
    expect(buildScheduleEventInput({
      calendarId: '',
      title: '늦은 일정',
      description: '',
      date: '2026-10-24',
      endDate: '2026-10-24',
      allDay: false,
      startTime: '23:30',
      endTime: '23:30',
    })).toMatchObject({
      date: '2026-10-24',
      endDate: '2026-10-24',
      allDay: false,
      startTime: '23:30',
      endTime: '23:59',
    })
  })

  it('keeps a saved cross-day 23:30 to next-day 00:30 when the edit form opens', () => {
    expect(editScheduleTimeFields({ allDay: false, startTime: '23:30', endTime: '00:30' })).toEqual({
      allDay: false,
      startTime: '23:30',
      endTime: '00:30',
    })
    expect(buildScheduleEventInput({
      calendarId: 'primary',
      title: '야간',
      description: '',
      date: '2026-10-24',
      endDate: '2026-10-25',
      ...editScheduleTimeFields({ allDay: false, startTime: '23:30', endTime: '00:30' }),
    })).toEqual({
      calendarId: 'primary',
      title: '야간',
      description: '',
      date: '2026-10-24',
      endDate: '2026-10-25',
      allDay: false,
      startTime: '23:30',
      endTime: '00:30',
    })
  })

  it('corrects an end time that is not after the start when the clock changes or the form is saved', () => {
    const timed = { allDay: false, startTime: '14:00', endTime: '15:30' }
    expect(withScheduleStartTime(timed, '18:15')).toMatchObject({ allDay: false, startTime: '18:15', endTime: '19:15' })
    expect(withScheduleEndTime({ allDay: false, startTime: '14:00', endTime: '15:30' }, '13:00').endTime).toBe('15:00')
    expect(scheduleEventWriteTimes({ allDay: false, startTime: '18:15', endTime: '09:00' })).toEqual({
      allDay: false,
      startTime: '18:15',
      endTime: '19:15',
    })
    expect(scheduleEventWriteTimes({ allDay: false, startTime: '23:40', endTime: '23:10' }).endTime).toBe('23:59')
  })

  it('saves 2026-10-24 14:00-15:30 as a timed event and an all-day event with null times', () => {
    expect(buildScheduleEventInput({
      calendarId: 'primary',
      title: '상담',
      description: '메모',
      date: '2026-10-24',
      endDate: '2026-10-24',
      allDay: false,
      startTime: '14:00',
      endTime: '15:30',
    })).toEqual({
      calendarId: 'primary',
      title: '상담',
      description: '메모',
      date: '2026-10-24',
      endDate: '2026-10-24',
      allDay: false,
      startTime: '14:00',
      endTime: '15:30',
    })
    expect(buildScheduleEventInput({
      calendarId: '',
      title: '종일',
      description: '',
      date: '2026-10-24',
      endDate: '',
      ...createScheduleTimeFields(),
    })).toEqual({
      calendarId: '',
      title: '종일',
      description: '',
      date: '2026-10-24',
      endDate: '2026-10-24',
      allDay: true,
      startTime: null,
      endTime: null,
    })
  })
})