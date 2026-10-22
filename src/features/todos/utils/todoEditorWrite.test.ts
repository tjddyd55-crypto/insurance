import { describe, expect, it } from 'vitest'
import { todoEditorDatePayload, todoEditorDueDateForOpen } from './todoEditorWrite'

const NOW = new Date('2026-10-13T15:30:00Z')

describe('todoEditorWrite', () => {
  it('keeps a saved due date on edit and leaves an undated todo empty', () => {
    expect(todoEditorDueDateForOpen({ mode: 'edit', savedDueDate: '2026-10-24', now: NOW })).toBe('2026-10-24')
    expect(todoEditorDueDateForOpen({ mode: 'edit', savedDueDate: null, now: NOW })).toBe('')
    expect(todoEditorDueDateForOpen({ mode: 'edit', savedDueDate: '', now: NOW })).toBe('')
    expect(todoEditorDueDateForOpen({ mode: 'edit', now: NOW })).toBe('')
  })

  it('opens a new todo on the selected day, otherwise today in Asia/Seoul', () => {
    expect(todoEditorDueDateForOpen({ mode: 'create', explicit: '2026-10-24', now: NOW })).toBe('2026-10-24')
    expect(todoEditorDueDateForOpen({ mode: 'create', explicit: null, now: NOW })).toBe('2026-10-14')
    expect(todoEditorDueDateForOpen({ mode: 'create', explicit: '2026-10-20T00:00:00Z', now: NOW })).toBe('2026-10-14')
  })

  it('sends dueTime null for a new todo', () => {
    expect(todoEditorDatePayload({ mode: 'create', dueDate: '2026-10-25', savedDueTime: '14:00' })).toEqual({
      dueDate: '2026-10-25',
      dueTime: null,
    })
    expect(todoEditorDatePayload({ mode: 'create', dueDate: '  2026-10-24  ' })).toEqual({
      dueDate: '2026-10-24',
      dueTime: null,
    })
  })

  it('keeps 14:00 on edit when the title or date changes, and clears both when the date is removed', () => {
    const savedDueTime = '14:00'
    expect(todoEditorDatePayload({ mode: 'edit', dueDate: '2026-10-25', savedDueTime })).toEqual({
      dueDate: '2026-10-25',
      dueTime: '14:00',
    })
    expect(todoEditorDatePayload({ mode: 'edit', dueDate: '2026-10-26', savedDueTime })).toEqual({
      dueDate: '2026-10-26',
      dueTime: '14:00',
    })
    expect(todoEditorDatePayload({ mode: 'edit', dueDate: '', savedDueTime })).toEqual({
      dueDate: null,
      dueTime: null,
    })
    expect(todoEditorDatePayload({ mode: 'edit', dueDate: '   ', savedDueTime })).toEqual({
      dueDate: null,
      dueTime: null,
    })
  })
})
