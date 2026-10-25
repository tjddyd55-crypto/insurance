import { describe, expect, it } from 'vitest'
import type { TodoDto } from '../../todos/domain/todoTypes'
import { buildCustomerTodoCreatePrefill, orderCustomerTodos } from './customerTodosOrder'

const row = (id: string, status: string) => ({ id, status }) as unknown as TodoDto

describe('orderCustomerTodos', () => {
  it('미완료 먼저, 완료는 아래에 유지하고 서버 날짜 순서는 보존', () => {
    const out = orderCustomerTodos([row('1', 'completed'), row('2', 'pending'), row('3', 'canceled'), row('4', 'pending'), row('5', 'completed')])
    expect(out.map((r) => r.id)).toEqual(['2', '4', '1', '5', '3'])
  })
})

describe('buildCustomerTodoCreatePrefill', () => {
  it('현재 고객을 기존 연결 필드(customer + id)로 고정', () => {
    expect(buildCustomerTodoCreatePrefill(1597, ' 홍길동 ')).toEqual({
      sourceType: 'manual',
      description: '',
      dueDate: null,
      relatedEntityType: 'customer',
      relatedEntityId: '1597',
      lockRelated: true,
      lockedCustomerSummary: '홍길동',
    })
  })
  it('이름이 없어도 고객 고정은 유지', () => {
    const p = buildCustomerTodoCreatePrefill(12, null)
    expect(p.relatedEntityId).toBe('12')
    expect(p.lockRelated).toBe(true)
    expect(p.lockedCustomerSummary).toBeUndefined()
  })
})

describe('고객 상세 할 일 저장 후 이동 없음(계약)', () => {
  it('CustomerTodosPage·TodoEditorDialog 에 라우트 이동/하드 리로드 코드가 없다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const rel of ['../pages/CustomerTodosPage.tsx', '../../todos/components/TodoEditorDialog.tsx']) {
      const src = fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
      expect(src).not.toMatch(/useNavigate|navigate\(|location\.(reload|assign|href\s*=)/)
    }
  })
})
