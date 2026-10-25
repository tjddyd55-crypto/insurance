import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')

describe('고객 상세 할 일 모달 계약', () => {
  it('작성창 사용자 문구는 날짜(마감일 아님), 내부 dueDate 유지', () => {
    const src = read('../../todos/components/TodoEditorDialog.tsx')
    expect(src).toContain('<span className="todo-editor-dialog__label">날짜</span>')
    expect(src).toContain('키워드로 날짜 제안')
    expect(src).not.toMatch(/>[^<{]*마감일[^<{]*</)
    expect(src).toContain('dueDate')
  })
  it.each([
    '../pages/CustomerTodosPage.tsx',
    '../pages/CustomerConsultationsPage.tsx',
    '../pages/CustomerMemosPage.tsx',
    '../components/mobile/CustomerConsultationsModal.tsx',
  ])('%s: TodoEditorDialog 는 portal 로 띄워 고객 상세 탭까지 전체 dim', (rel) => {
    const src = read(rel)
    expect(src).toMatch(/<TodoEditorDialog[^>]*\busePortal\b/)
  })
})
