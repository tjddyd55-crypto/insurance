import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_ALERT_SETTINGS,
  NOTIFICATION_PANEL_PREVIEW_COUNT,
  NOTIFICATION_SECTIONS,
} from '../config/notificationCenter.config'

describe('notification panel layout config', () => {
  it('keeps four panels and a compact preview count', () => {
    expect(NOTIFICATION_SECTIONS).toHaveLength(4)
    expect(NOTIFICATION_SECTIONS.map((s) => s.type)).toEqual([
      'insurance_age_date',
      'car_expiry',
      'special_date',
      'claim_request_received',
    ])
    expect(NOTIFICATION_PANEL_PREVIEW_COUNT).toBe(5)
  })

  it('provides default alert settings for modal fallback', () => {
    expect(DEFAULT_USER_ALERT_SETTINGS.insuranceAge).toEqual({ enabled: true, daysBefore: 30 })
    expect(DEFAULT_USER_ALERT_SETTINGS.claimRequest.enabled).toBe(true)
  })
})
