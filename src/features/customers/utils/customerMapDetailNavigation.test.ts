import { describe, expect, it } from 'vitest'
import { parseMapEntryExpandCustomerId } from './customerMapDetailNavigation'

describe('parseMapEntryExpandCustomerId', () => {
  it('reads expandCustomerId from customer-map navigation state', () => {
    expect(
      parseMapEntryExpandCustomerId({
        from: 'customer-map',
        expandCustomerId: 191,
        selectedCustomerId: 191,
        mapState: { selectedCustomerId: 191 },
      }),
    ).toBe(191)
  })

  it('falls back to selectedCustomerId when expandCustomerId is missing', () => {
    expect(
      parseMapEntryExpandCustomerId({
        from: 'customer-map',
        selectedCustomerId: 42,
        mapState: { selectedCustomerId: 42 },
      }),
    ).toBe(42)
  })

  it('returns null for unrelated navigation state', () => {
    expect(parseMapEntryExpandCustomerId(null)).toBeNull()
    expect(parseMapEntryExpandCustomerId({ customerName: '홍길동' })).toBeNull()
    expect(parseMapEntryExpandCustomerId({ from: 'other', expandCustomerId: 1 })).toBeNull()
  })
})
