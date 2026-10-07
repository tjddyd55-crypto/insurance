import { describe, expect, it } from 'vitest'

import { formatCustomerSimulationListMetaLines } from './formatCustomerSimulationListMeta'

describe('formatCustomerSimulationListMetaLines', () => {
  it('shows only 수정 once when created and updated are the same day', () => {
    expect(
      formatCustomerSimulationListMetaLines({
        createdAt: '2026-10-07',
        updatedAt: '2026-10-07',
      }),
    ).toEqual(['수정 2026.10.07'])
  })

  it('shows 작성 and 수정 when dates differ', () => {
    const lines = formatCustomerSimulationListMetaLines({
      createdAt: '2026-10-05',
      updatedAt: '2026-10-07',
    })
    expect(lines).toEqual(['작성 2026.10.05', '수정 2026.10.07'])
  })
})
