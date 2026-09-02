import { safeQuery } from '../utils/dbSafeQuery.js'

export const DEFAULT_NOTIFICATION_DAYS_BEFORE = 30
export const MIN_NOTIFICATION_DAYS_BEFORE = 0
export const MAX_NOTIFICATION_DAYS_BEFORE = 365

/**
 * @typedef {{ enabled: boolean, daysBefore: number }} WindowedNotificationSetting
 * @typedef {{ enabled: boolean }} ToggleNotificationSetting
 * @typedef {{
 *   appPush: ToggleNotificationSetting,
 *   newCustomer: ToggleNotificationSetting,
 *   customerAppFile: ToggleNotificationSetting,
 *   workAlert: ToggleNotificationSetting,
 *   insuranceAge: WindowedNotificationSetting,
 *   carExpiry: WindowedNotificationSetting,
 *   specialDate: WindowedNotificationSetting,
 *   claimRequest: ToggleNotificationSetting,
 * }} UserNotificationSettings
 */

/** @returns {UserNotificationSettings} */
export function getDefaultUserNotificationSettings() {
  return {
    appPush: { enabled: true },
    newCustomer: { enabled: true },
    customerAppFile: { enabled: true },
    workAlert: { enabled: true },
    insuranceAge: { enabled: true, daysBefore: DEFAULT_NOTIFICATION_DAYS_BEFORE },
    carExpiry: { enabled: true, daysBefore: DEFAULT_NOTIFICATION_DAYS_BEFORE },
    specialDate: { enabled: true, daysBefore: DEFAULT_NOTIFICATION_DAYS_BEFORE },
    claimRequest: { enabled: true },
  }
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function normalizeDaysBefore(value) {
  if (value == null || value === '') {
    return null
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isInteger(n) || n < MIN_NOTIFICATION_DAYS_BEFORE || n > MAX_NOTIFICATION_DAYS_BEFORE) {
    return null
  }
  return n
}

/**
 * @param {import('pg').QueryResultRow | null | undefined} row
 * @returns {UserNotificationSettings}
 */
export function mapUserNotificationSettingsRow(row) {
  const defaults = getDefaultUserNotificationSettings()
  if (!row) {
    return defaults
  }
  return {
    appPush: {
      enabled: row.app_push_enabled !== false,
    },
    newCustomer: {
      enabled: row.new_customer_enabled !== false,
    },
    customerAppFile: {
      enabled: row.customer_app_file_enabled !== false,
    },
    workAlert: {
      enabled: row.work_alert_enabled !== false,
    },
    insuranceAge: {
      enabled: row.insurance_age_enabled !== false,
      daysBefore: normalizeDaysBefore(row.insurance_age_days_before) ?? defaults.insuranceAge.daysBefore,
    },
    carExpiry: {
      enabled: row.car_expiry_enabled !== false,
      daysBefore: normalizeDaysBefore(row.car_expiry_days_before) ?? defaults.carExpiry.daysBefore,
    },
    specialDate: {
      enabled: row.special_date_enabled !== false,
      daysBefore: normalizeDaysBefore(row.special_date_days_before) ?? defaults.specialDate.daysBefore,
    },
    claimRequest: {
      enabled: row.claim_request_enabled !== false,
    },
  }
}

/**
 * @param {unknown} body
 * @param {UserNotificationSettings} [base]
 * @returns {{ ok: true, data: UserNotificationSettings } | { ok: false, message: string }}
 */
export function normalizeUserNotificationSettingsPatch(body, base = getDefaultUserNotificationSettings()) {
  const source = body && typeof body === 'object' ? body : {}
  /** @type {UserNotificationSettings} */
  const next = {
    appPush: { ...base.appPush },
    newCustomer: { ...base.newCustomer },
    customerAppFile: { ...base.customerAppFile },
    workAlert: { ...base.workAlert },
    insuranceAge: { ...base.insuranceAge },
    carExpiry: { ...base.carExpiry },
    specialDate: { ...base.specialDate },
    claimRequest: { ...base.claimRequest },
  }

  const applyToggle = (key, label) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return null
    }
    const section = source[key]
    if (!section || typeof section !== 'object') {
      return `${label} 설정 형식이 올바르지 않습니다.`
    }
    if (Object.prototype.hasOwnProperty.call(section, 'enabled')) {
      next[key].enabled = section.enabled === true
    }
    return null
  }

  for (const [key, label] of [
    ['appPush', '전체 앱 알림'],
    ['newCustomer', '신규 고객 등록 알림'],
    ['customerAppFile', '고객 파일/문의 알림'],
    ['workAlert', '업무 알림'],
    ['claimRequest', '청구요청 알림'],
  ]) {
    const err = applyToggle(key, label)
    if (err) {
      return { ok: false, message: err }
    }
  }

  const applyWindowed = (key, label) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return null
    }
    const section = source[key]
    if (!section || typeof section !== 'object') {
      return `${label} 설정 형식이 올바르지 않습니다.`
    }
    if (Object.prototype.hasOwnProperty.call(section, 'enabled')) {
      next[key].enabled = section.enabled === true
    }
    if (Object.prototype.hasOwnProperty.call(section, 'daysBefore')) {
      const days = normalizeDaysBefore(section.daysBefore)
      if (days == null) {
        return `${label} 표시 시작일은 0~365 사이 정수여야 합니다.`
      }
      next[key].daysBefore = days
    }
    return null
  }

  for (const [key, label] of [
    ['insuranceAge', '상령일 알림'],
    ['carExpiry', '자동차 만기 알림'],
    ['specialDate', '지정일 알림'],
  ]) {
    const err = applyWindowed(key, label)
    if (err) {
      return { ok: false, message: err }
    }
  }

  return { ok: true, data: next }
}

const SETTINGS_SELECT_COLUMNS = `
  app_push_enabled,
  new_customer_enabled,
  customer_app_file_enabled,
  work_alert_enabled,
  insurance_age_enabled,
  insurance_age_days_before,
  car_expiry_enabled,
  car_expiry_days_before,
  special_date_enabled,
  special_date_days_before,
  claim_request_enabled
`

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} userId
 * @param {number} gaId
 * @param {typeof import('../utils/dbSafeQuery.js').safeQuery} [safeQueryExec]
 * @returns {Promise<UserNotificationSettings>}
 */
export async function getUserNotificationSettings(db, userId, gaId, safeQueryExec = safeQuery) {
  try {
    const r = await safeQueryExec(
      db,
      `
      SELECT ${SETTINGS_SELECT_COLUMNS}
      FROM user_notification_settings
      WHERE user_id = $1 AND ga_id = $2
      LIMIT 1
      `,
      [userId, gaId],
    )
    return mapUserNotificationSettingsRow(r.rows[0])
  } catch (error) {
    console.error('[userNotificationSettingsService] getUserNotificationSettings failed', {
      userId,
      gaId,
      error,
    })
    return getDefaultUserNotificationSettings()
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} userId
 * @param {number} gaId
 * @param {UserNotificationSettings} settings
 * @returns {Promise<UserNotificationSettings>}
 */
export async function upsertUserNotificationSettings(db, userId, gaId, settings) {
  const r = await safeQuery(
    db,
    `
    INSERT INTO user_notification_settings (
      user_id,
      ga_id,
      app_push_enabled,
      new_customer_enabled,
      customer_app_file_enabled,
      work_alert_enabled,
      insurance_age_enabled,
      insurance_age_days_before,
      car_expiry_enabled,
      car_expiry_days_before,
      special_date_enabled,
      special_date_days_before,
      claim_request_enabled
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (ga_id, user_id) DO UPDATE
    SET
      app_push_enabled = EXCLUDED.app_push_enabled,
      new_customer_enabled = EXCLUDED.new_customer_enabled,
      customer_app_file_enabled = EXCLUDED.customer_app_file_enabled,
      work_alert_enabled = EXCLUDED.work_alert_enabled,
      insurance_age_enabled = EXCLUDED.insurance_age_enabled,
      insurance_age_days_before = EXCLUDED.insurance_age_days_before,
      car_expiry_enabled = EXCLUDED.car_expiry_enabled,
      car_expiry_days_before = EXCLUDED.car_expiry_days_before,
      special_date_enabled = EXCLUDED.special_date_enabled,
      special_date_days_before = EXCLUDED.special_date_days_before,
      claim_request_enabled = EXCLUDED.claim_request_enabled,
      updated_at = NOW()
    RETURNING ${SETTINGS_SELECT_COLUMNS}
    `,
    [
      userId,
      gaId,
      settings.appPush.enabled,
      settings.newCustomer.enabled,
      settings.customerAppFile.enabled,
      settings.workAlert.enabled,
      settings.insuranceAge.enabled,
      settings.insuranceAge.daysBefore,
      settings.carExpiry.enabled,
      settings.carExpiry.daysBefore,
      settings.specialDate.enabled,
      settings.specialDate.daysBefore,
      settings.claimRequest.enabled,
    ],
  )
  return mapUserNotificationSettingsRow(r.rows[0])
}
