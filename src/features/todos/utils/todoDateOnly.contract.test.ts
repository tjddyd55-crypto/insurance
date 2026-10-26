import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** 할 일(Todo) = 날짜만. 작성창·목록 어디에도 시간 입력/표시가 없어야 한다(일정 Event 는 별개). */
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')

describe('Todo date-only 계약', () => {
  it('TodoEditorDialog: 시간 입력 없음(main 정책: 수정 시 기존 dueTime 은 화면에 보이지 않게 보존)', () => {
    const src = read('../components/TodoEditorDialog.tsx')
    expect(src).not.toMatch(/type=["']time["']/)
    expect(src).not.toMatch(/setDueTime/)
  })
  it('Todo 표시 화면에 dueTime 을 렌더하지 않음', () => {
    for (const rel of [
      '../components/ScheduleCalendarView.tsx',
      '../../customers/pages/CustomerTodosPage.tsx',
      '../pages/todos-workspace/TodosWorkspacePCView.tsx',
      '../pages/todos-workspace/TodosWorkspaceMobileView.tsx',
    ]) {
      expect(read(rel), rel).not.toMatch(/dueTime/)
    }
  })
  it('일정 화면 할 일 예정일 라벨은 날짜만(일정 시간 표시는 그대로)', () => {
    const src = read('../../schedule/components/ScheduleBoards.tsx')
    const fn = src.slice(src.indexOf('function taskDueLabel'), src.indexOf('function taskDueLabel') + 300)
    expect(fn).not.toMatch(/dueTime/)
  })
})
