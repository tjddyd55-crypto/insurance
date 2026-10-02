import { describe, expect, it } from 'vitest'

import { isTodoEditorFormChanged, type TodoEditorForm } from './todoEditorDirty'
import { sortTodosNewestActivityFirst } from './sortTodosByRecentActivity'

const base: TodoEditorForm = {
  description: '보험 상담',
  dueDate: '2026-10-05',
  relatedEntityType: '',
  relatedEntityId: '',
}

type Row = { id: string; title: string; createdAt: string; updatedAt: string }

function row(id: string, title: string, at: string): Row {
  return { id, title, createdAt: at, updatedAt: at }
}

const listABC = (): Row[] => [
  row('1', 'A 최근', '2026-10-01T03:00:00.000Z'),
  row('2', 'B 중간', '2026-10-01T02:00:00.000Z'),
  row('3', 'C 오래됨', '2026-10-01T01:00:00.000Z'),
]

/** 저장 결과를 목록에 반영하는 흐름: 바뀐 게 없으면 요청 없이 그대로, 바뀌면 서버가 새 updatedAt을 준다. */
function saveEdit(rows: Row[], id: string, initial: TodoEditorForm, current: TodoEditorForm, savedAt: string): Row[] {
  if (!isTodoEditorFormChanged(initial, current)) return sortTodosNewestActivityFirst(rows)
  return sortTodosNewestActivityFirst(
    rows.map((r) => (r.id === id ? { ...r, title: current.description, updatedAt: savedAt } : r)),
  )
}

describe('isTodoEditorFormChanged', () => {
  it('A: 아무것도 바꾸지 않고 저장하면 변경 아님, 순서 그대로', () => {
    expect(isTodoEditorFormChanged(base, { ...base })).toBe(false)
    const rows = listABC()
    const cInitial = { ...base, description: 'C 오래됨' }
    const after = saveEdit(rows, '3', cInitial, { ...cInitial }, '2026-10-02T00:00:00.000Z')
    expect(after.map((r) => r.id)).toEqual(['1', '2', '3'])
    expect(after.find((r) => r.id === '3')?.updatedAt).toBe('2026-10-01T01:00:00.000Z')
  })

  it('B: 제목(첫 줄)을 바꾸면 변경, 맨 위로', () => {
    expect(isTodoEditorFormChanged(base, { ...base, description: '보험 갱신 상담' })).toBe(true)
    const cInitial = { ...base, description: 'C 오래됨' }
    const after = saveEdit(listABC(), '3', cInitial, { ...cInitial, description: 'C 수정' }, '2026-10-02T00:00:00.000Z')
    expect(after.map((r) => r.id)).toEqual(['3', '1', '2'])
  })

  it('C: 바꿨다가 원래 값으로 되돌리고 저장하면 변경 아님', () => {
    let current = { ...base }
    current = { ...current, description: '보험 갱신 상담' }
    current = { ...current, description: '보험 상담' }
    expect(isTodoEditorFormChanged(base, current)).toBe(false)
  })

  it('D: 메모(둘째 줄 이후) 실제 변경도 변경', () => {
    expect(isTodoEditorFormChanged(base, { ...base, description: '보험 상담\n서류 준비' })).toBe(true)
  })

  it('E: 마감일 실제 변경은 변경', () => {
    expect(isTodoEditorFormChanged(base, { ...base, dueDate: '2026-10-20' })).toBe(true)
    expect(isTodoEditorFormChanged(base, { ...base, dueDate: '' })).toBe(true)
  })

  it('저장 규칙상 같은 값(앞뒤 공백, 연결 유형 없는 id)은 변경 아님', () => {
    expect(isTodoEditorFormChanged(base, { ...base, description: '  보험 상담 \n', dueDate: ' 2026-10-05 ' })).toBe(
      false,
    )
    expect(isTodoEditorFormChanged(base, { ...base, relatedEntityId: '55' })).toBe(false)
    expect(
      isTodoEditorFormChanged(base, { ...base, relatedEntityType: 'customer', relatedEntityId: '55' }),
    ).toBe(true)
  })

  it('F: 신규 생성은 맨 위', () => {
    const created = row('4', 'D 신규', '2026-10-02T00:00:00.000Z')
    expect(sortTodosNewestActivityFirst([...listABC(), created]).map((r) => r.id)).toEqual(['4', '1', '2', '3'])
  })

  it('G: no-op 저장을 반복하고 다시 정렬해도 순서·timestamp 그대로', () => {
    const cInitial = { ...base, description: 'C 오래됨' }
    let rows = listABC()
    rows = saveEdit(rows, '3', cInitial, { ...cInitial }, '2026-10-02T00:00:00.000Z')
    rows = saveEdit(rows, '3', cInitial, { ...cInitial }, '2026-10-02T00:05:00.000Z')
    expect(sortTodosNewestActivityFirst(rows).map((r) => [r.id, r.updatedAt])).toEqual(
      listABC().map((r) => [r.id, r.updatedAt]),
    )
  })
})
