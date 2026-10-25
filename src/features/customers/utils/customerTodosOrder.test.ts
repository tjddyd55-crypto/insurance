import { describe, expect, it } from 'vitest'
import type { TodoDto } from '../../todos/domain/todoTypes'
import { orderCustomerTodos } from './customerTodosOrder'

const row = (id: string, status: string) => ({ id, status }) as unknown as TodoDto

describe('orderCustomerTodos', () => {
  it('미완료 먼저, 완료는 아래에 유지하고 서버 날짜 순서는 보존', () => {
    const out = orderCustomerTodos([row('1', 'completed'), row('2', 'pending'), row('3', 'canceled'), row('4', 'pending'), row('5', 'completed')])
    expect(out.map((r) => r.id)).toEqual(['2', '4', '1', '5', '3'])
  })
})
