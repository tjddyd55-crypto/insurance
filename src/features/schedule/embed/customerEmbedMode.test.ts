import { describe, expect, it } from 'vitest'
import { shouldEnableCustomerEmbed } from './customerEmbedMode'

const loc = (search: string) => ({ search } as Location)

describe('shouldEnableCustomerEmbed', () => {
  it('일반 창(top)에서는 쿼리가 있어도 켜지지 않는다', () => {
    const w = {} as Window & typeof globalThis
    expect(shouldEnableCustomerEmbed({ self: w, top: w, location: loc('?embed=customer') })).toBe(false)
  })
  it('iframe + embed=customer 일 때만 켜진다', () => {
    expect(shouldEnableCustomerEmbed({ self: {} as Window & typeof globalThis, top: {} as Window & typeof globalThis, location: loc('?customerId=1&embed=customer') })).toBe(true)
    expect(shouldEnableCustomerEmbed({ self: {} as Window & typeof globalThis, top: {} as Window & typeof globalThis, location: loc('?customerId=1') })).toBe(false)
  })
})
