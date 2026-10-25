import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('모바일 고객 상세 라우트 계약', () => {
  it('isMobileDetailRoute 정규식이 /customers/:id/todos 를 포함', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../pages/workspace/CustomerWorkspaceLayoutMobile.tsx'), 'utf8')
    const line = src.split('\n').find((l) => l.includes('/^\\/customers\\/\\d+\\/(?:'))
    expect(line).toBeDefined()
    expect(line).toMatch(/\|todos\|/)
  })
})
