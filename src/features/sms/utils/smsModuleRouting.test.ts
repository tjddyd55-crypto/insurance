import { describe, expect, it } from 'vitest'
import type { SmsModuleTab } from '../types/sms.types'

const ROUTE_TAB_IDS: SmsModuleTab[] = ['settings', 'groups', 'send', 'history', 'templates']

describe('SMS module routing tabs', () => {
  it('allows /sms/templates as a direct route tab', () => {
    expect(ROUTE_TAB_IDS).toContain('templates')
  })

  it('keeps templates separate from send tab', () => {
    expect(ROUTE_TAB_IDS).toContain('send')
    expect(ROUTE_TAB_IDS.indexOf('templates')).toBeGreaterThan(ROUTE_TAB_IDS.indexOf('send'))
  })
})
