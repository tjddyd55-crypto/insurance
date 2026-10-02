import { describe, expect, it } from 'vitest'

import { sortTodosNewestActivityFirst } from './sortTodosByRecentActivity'

function row(id: string, createdAt: string | null, updatedAt: string | null = createdAt) {
  return { id, createdAt, updatedAt }
}

describe('sortTodosNewestActivityFirst', () => {
  it('puts a newly created todo before an older one', () => {
    const older = row('a', '2026-09-01T00:00:00.000Z')
    const newer = row('b', '2026-10-02T00:00:00.000Z')
    expect(sortTodosNewestActivityFirst([older, newer]).map((item) => item.id)).toEqual(['b', 'a'])
  })

  it('puts a recently edited todo before a newer create that was not edited later', () => {
    const createdLater = row('created', '2026-10-02T09:00:00.000Z', '2026-10-02T09:00:00.000Z')
    const editedLater = row('edited', '2026-09-01T00:00:00.000Z', '2026-10-02T12:00:00.000Z')
    expect(sortTodosNewestActivityFirst([createdLater, editedLater]).map((item) => item.id)).toEqual([
      'edited',
      'created',
    ])
  })

  it('uses createdAt when updatedAt is missing', () => {
    const onlyCreated = row('created', '2026-10-02T00:00:00.000Z', null)
    const older = row('older', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
    expect(sortTodosNewestActivityFirst([older, onlyCreated]).map((item) => item.id)).toEqual([
      'created',
      'older',
    ])
  })

  it('keeps rows with no timestamps last and does not mutate the input', () => {
    const undated = row('undated', null, null)
    const dated = row('dated', '2026-10-01T00:00:00.000Z')
    const input = [undated, dated]
    expect(sortTodosNewestActivityFirst(input).map((item) => item.id)).toEqual(['dated', 'undated'])
    expect(input.map((item) => item.id)).toEqual(['undated', 'dated'])
  })
})
