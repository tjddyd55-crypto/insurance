import { describe, expect, it } from 'vitest'
import {
  buildSmsSendCustomerIdsText,
  buildSmsSendGroupSummary,
  resolveSmsSendGroupFetchDecision,
} from './smsSendGroupSelection'

describe('smsSendGroupSelection', () => {
  it('builds group summary from member send eligibility', () => {
    expect(
      buildSmsSendGroupSummary([
        { canSend: true },
        { canSend: false },
        { canSend: true },
      ]),
    ).toEqual({
      total: 3,
      sendable: 2,
      excluded: 1,
    })
  })

  it('builds customer id text for bulk send', () => {
    expect(
      buildSmsSendCustomerIdsText([
        { customerId: 10 },
        { customerId: 20 },
      ]),
    ).toBe('10, 20')
  })

  it('skips fetch when group id is empty', () => {
    expect(resolveSmsSendGroupFetchDecision('', new Map())).toBe('skip-empty')
  })

  it('uses cache when the same group id was already loaded', () => {
    const cache = new Map<string, unknown>([['12', []]])
    expect(resolveSmsSendGroupFetchDecision('12', cache)).toBe('use-cache')
    expect(resolveSmsSendGroupFetchDecision('13', cache)).toBe('fetch')
  })
})
