import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_ALERT_SETTINGS,
  NOTIFICATION_PANEL_PREVIEW_COUNT,
  NOTIFICATION_SECTIONS,
} from '../config/notificationCenter.config'

describe('notification panel layout config', () => {
  it('keeps the notification panels, including consultation leads, and a compact preview count', () => {
    expect(NOTIFICATION_SECTIONS).toHaveLength(5)
    expect(NOTIFICATION_SECTIONS.map((s) => s.type)).toEqual([
      'insurance_age_date',
      'car_expiry',
      'special_date',
      'claim_request_received',
      'advisor_consultation_lead',
    ])
    expect(NOTIFICATION_SECTIONS.find((s) => s.type === 'advisor_consultation_lead')).toMatchObject({
      title: '상담 신청',
      dateColumnLabel: '신청일',
      sectionClass: 'consultation',
    })
    expect(NOTIFICATION_PANEL_PREVIEW_COUNT).toBe(5)
  })

  it('provides default alert settings for modal fallback', () => {
    expect(DEFAULT_USER_ALERT_SETTINGS.insuranceAge).toEqual({ enabled: true, daysBefore: 30 })
    expect(DEFAULT_USER_ALERT_SETTINGS.claimRequest.enabled).toBe(true)
  })
})
