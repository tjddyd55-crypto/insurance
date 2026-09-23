import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_DESIGNATED_DATE_SETTINGS_HINT } from '../../../../shared/customerDesignatedDateCopy.js'
import {
  DEFAULT_USER_ALERT_SETTINGS,
  NOTIFICATION_PANEL_PREVIEW_COUNT,
  NOTIFICATION_SECTIONS,
} from '../config/notificationCenter.config'

const modalSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/NotificationSettingsModal.tsx'),
  'utf8',
)

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

  it('explains designated-date lead time separately from age and car expiry', () => {
    expect(CUSTOMER_DESIGNATED_DATE_SETTINGS_HINT).toContain('지정일')
    expect(CUSTOMER_DESIGNATED_DATE_SETTINGS_HINT).toContain('따로')
    expect(CUSTOMER_DESIGNATED_DATE_SETTINGS_HINT).not.toContain('지정일(상령일')
    expect(modalSource).toContain('CUSTOMER_DESIGNATED_DATE_SETTINGS_HINT')
    expect(modalSource).toContain('INSURANCE_AGE_NOTIFICATION_SETTINGS_HINT')
    expect(modalSource).toContain('CAR_EXPIRY_NOTIFICATION_SETTINGS_HINT')
    expect(modalSource).not.toContain('지정일(상령일, 자동차만기)')
  })
})
