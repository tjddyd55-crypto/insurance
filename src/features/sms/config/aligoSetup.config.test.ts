import { describe, expect, it } from 'vitest'
import { resolveAligoOutboundIps } from './aligoSetup.config'

describe('resolveAligoOutboundIps', () => {
  it('prefers array over hint string', () => {
    expect(
      resolveAligoOutboundIps({
        outboundServerIps: ['1.1.1.1', '2.2.2.2'],
        outboundServerIpHint: '9.9.9.9',
      }),
    ).toEqual(['1.1.1.1', '2.2.2.2'])
  })

  it('parses comma-separated hint', () => {
    expect(
      resolveAligoOutboundIps({
        outboundServerIpHint: '1.1.1.1, 2.2.2.2',
      }),
    ).toEqual(['1.1.1.1', '2.2.2.2'])
  })

  it('returns empty when unset (no EC2 hardcode)', () => {
    expect(resolveAligoOutboundIps({})).toEqual([])
  })
})
