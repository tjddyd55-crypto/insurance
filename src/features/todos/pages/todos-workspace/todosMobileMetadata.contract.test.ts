import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(process.cwd(), 'src/features/todos/pages/todos-workspace/TodosWorkspaceMobileView.tsx'),
  'utf8',
)

/** 모바일 할 일 카드 보조 줄(연결·날짜·출처)은 14px(text-sm)로 표시한다. */
describe('TodosWorkspaceMobileView metadata typography', () => {
  it('uses text-sm on the metadata block, not text-xs', () => {
    const idx = src.indexOf('연결:')
    expect(idx).toBeGreaterThan(-1)
    const open = src.lastIndexOf('<div className="', idx)
    const cls = src.slice(open, src.indexOf('>', open))
    expect(cls).toContain('text-sm')
    expect(cls).not.toContain('text-xs')
    expect(src).toContain('날짜 {formatTodoDueDateDisplay')
    expect(src).toContain('<div>출처 {todoSourceLabel')
  })
})
