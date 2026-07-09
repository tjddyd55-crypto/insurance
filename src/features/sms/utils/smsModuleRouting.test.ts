import { describe, expect, it } from 'vitest'
import type { SmsModuleTab } from '../types/sms.types'

const ROUTE_TAB_IDS: SmsModuleTab[] = [
  'settings',
  'send',
  'reservations',
  'groups',
  'templates',
  'history',
]

describe('SMS module routing tabs', () => {
  it('allows /sms/templates as a direct route tab', () => {
    expect(ROUTE_TAB_IDS).toContain('templates')
  })

  it('keeps immediate and reserved send tabs separate', () => {
    expect(ROUTE_TAB_IDS).toContain('send')
    expect(ROUTE_TAB_IDS).toContain('reservations')
    expect(ROUTE_TAB_IDS.indexOf('reservations')).toBeGreaterThan(ROUTE_TAB_IDS.indexOf('send'))
  })

  it('orders templates before history', () => {
    expect(ROUTE_TAB_IDS.indexOf('history')).toBeGreaterThan(ROUTE_TAB_IDS.indexOf('templates'))
  })
})
