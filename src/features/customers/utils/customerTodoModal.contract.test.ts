import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')

describe('고객 할 일 모달 계약', () => {
  it('작성창 사용자 문구는 날짜(마감일 아님)', () => {
    const src = read('../../todos/components/TodoEditorDialog.tsx')
    expect(src).toContain('<span className="todo-editor-dialog__label">날짜</span>')
    expect(src).toContain('키워드로 날짜 제안')
    expect(src).not.toMatch(/>[^<{]*마감일[^<{]*</)
  })
  it('고객 할 일 탭은 portal 로 띄워 탭 stacking context 밖에서 dim', () => {
    const src = read('../pages/CustomerTodosPage.tsx')
    expect(src).toMatch(/<TodoEditorDialog[^>]*\busePortal\b/)
  })
})
