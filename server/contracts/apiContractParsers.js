/**
 * Web/Native contract regression parsers (mirrors client normalization in pure JS).
 */

const DEFAULT_ALERT_SETTINGS = {
  appPush: { enabled: true },
  newCustomer: { enabled: true },
  customerAppFile: { enabled: true },
  workAlert: { enabled: true },
  insuranceAge: { enabled: true, daysBefore: 30 },
  carExpiry: { enabled: true, daysBefore: 30 },
  specialDate: { enabled: true, daysBefore: 30 },
  claimRequest: { enabled: true },
}

function normalizeToggle(value, fallback) {
  if (!value || typeof value !== 'object') {
    return { ...fallback }
  }
  return { enabled: value.enabled !== false }
}

function normalizeWindowed(value, fallback) {
  if (!value || typeof value !== 'object') {
    return { ...fallback }
  }
  const days = Number(value.daysBefore ?? value.days_before)
  return {
    enabled: value.enabled !== false,
    daysBefore: Number.isInteger(days) && days >= 0 && days <= 365 ? days : fallback.daysBefore,
  }
}

/** Native: notificationModel.normalizeNotificationSettings */
export function parseNativeNotificationSettings(value) {
  const row = value && typeof value === 'object' ? value : {}
  return {
    appPush: normalizeToggle(row.appPush ?? row.app_push, DEFAULT_ALERT_SETTINGS.appPush),
    newCustomer: normalizeToggle(row.newCustomer ?? row.new_customer, DEFAULT_ALERT_SETTINGS.newCustomer),
    customerAppFile: normalizeToggle(
      row.customerAppFile ?? row.customer_app_file,
      DEFAULT_ALERT_SETTINGS.customerAppFile,
    ),
    workAlert: normalizeToggle(row.workAlert ?? row.work_alert, DEFAULT_ALERT_SETTINGS.workAlert),
    insuranceAge: normalizeWindowed(row.insuranceAge ?? row.insurance_age, DEFAULT_ALERT_SETTINGS.insuranceAge),
    carExpiry: normalizeWindowed(row.carExpiry ?? row.car_expiry, DEFAULT_ALERT_SETTINGS.carExpiry),
    specialDate: normalizeWindowed(row.specialDate ?? row.special_date, DEFAULT_ALERT_SETTINGS.specialDate),
    claimRequest: normalizeToggle(row.claimRequest ?? row.claim_request, DEFAULT_ALERT_SETTINGS.claimRequest),
  }
}

/** Web: notification settings modal consumes the shared 4-field subset. */
export function parseWebNotificationSettingsEnvelope(body) {
  const value =
    body && typeof body === 'object' && 'data' in body ? body.data : body
  const row = value && typeof value === 'object' ? value : {}
  return {
    insuranceAge: normalizeWindowed(row.insuranceAge ?? row.insurance_age, DEFAULT_ALERT_SETTINGS.insuranceAge),
    carExpiry: normalizeWindowed(row.carExpiry ?? row.car_expiry, DEFAULT_ALERT_SETTINGS.carExpiry),
    specialDate: normalizeWindowed(row.specialDate ?? row.special_date, DEFAULT_ALERT_SETTINGS.specialDate),
    claimRequest: normalizeToggle(row.claimRequest ?? row.claim_request, DEFAULT_ALERT_SETTINGS.claimRequest),
  }
}

export function parseWebLoginSession(body) {
  if (!body || typeof body !== 'object' || typeof body.token !== 'string' || !body.token.trim()) {
    throw new Error('invalid_login_response')
  }
  const user = body.user
  if (!user || typeof user !== 'object') {
    throw new Error('invalid_login_user')
  }
  const gaIdRaw = user.ga_id
  const gaId =
    typeof gaIdRaw === 'number' && Number.isInteger(gaIdRaw) && gaIdRaw > 0 ? gaIdRaw : 0
  return {
    token: body.token.trim(),
    userId: String(user.id ?? ''),
    username: String(user.username ?? ''),
    role: String(user.role ?? ''),
    gaId,
    gaCode: typeof user.ga_code === 'string' ? user.ga_code.trim().toUpperCase() : '',
    displayName:
      typeof user.display_name === 'string' && user.display_name.trim()
        ? user.display_name.trim()
        : String(user.username ?? '').trim(),
    crmIndustryCode:
      typeof user.crm_industry_code === 'string' ? user.crm_industry_code.trim() : null,
    hasTenantCrm: user.tenant_crm != null,
  }
}

export function parseNativeLoginSession(body) {
  if (!body || typeof body !== 'object' || typeof body.token !== 'string' || !body.token.trim()) {
    throw new Error('invalid_login_response')
  }
  const user = body.user
  if (!user || typeof user !== 'object') {
    throw new Error('invalid_login_user')
  }
  const gaIdRaw = user.ga_id
  const gaId =
    typeof gaIdRaw === 'number' && Number.isInteger(gaIdRaw) && gaIdRaw > 0 ? gaIdRaw : 0
  return {
    token: body.token.trim(),
    userId: String(user.id ?? ''),
    username: String(user.username ?? ''),
    role: String(user.role ?? ''),
    gaId,
    gaCode: typeof user.ga_code === 'string' ? user.ga_code.trim().toUpperCase() : '',
    displayName:
      typeof user.display_name === 'string' && user.display_name.trim()
        ? user.display_name.trim()
        : String(user.username ?? '').trim(),
    crmIndustryCode: null,
    hasTenantCrm: false,
  }
}

export function parseWebCreateCustomerRelation(body) {
  if (!body || typeof body !== 'object' || body.ok !== true) {
    throw new Error('invalid_relation_post')
  }
  const customerId = Number(body.customerId)
  const relatedCustomerId = Number(body.relatedCustomerId)
  if (!Number.isInteger(customerId) || !Number.isInteger(relatedCustomerId)) {
    throw new Error('invalid_relation_ids')
  }
  return { customerId, relatedCustomerId }
}

export function parseNativeCreateCustomerRelation(body, fallbackRelatedId) {
  if (!body || typeof body !== 'object') {
    throw new Error('invalid_relation_post')
  }
  if (body.ok === true) {
    const relatedCustomerId = Number(body.relatedCustomerId ?? fallbackRelatedId)
    const customerId = Number(body.customerId)
    if (!Number.isInteger(relatedCustomerId) || !Number.isInteger(customerId)) {
      throw new Error('invalid_relation_ids')
    }
    return { customerId, relatedCustomerId, mode: 'ack' }
  }
  const relatedCustomerId = Number(body.relatedCustomerId)
  if (!Number.isInteger(relatedCustomerId)) {
    throw new Error('invalid_relation_row')
  }
  return {
    customerId: null,
    relatedCustomerId,
    relatedName: String(body.relatedName ?? ''),
    relatedPhone: String(body.relatedPhone ?? ''),
    mode: 'legacy-row',
  }
}

export function parseNativeNotificationList(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.notifications)) {
    throw new Error('invalid_notification_list')
  }
  return {
    count: body.notifications.length,
    firstType: String(body.notifications[0]?.type ?? ''),
    settings: parseNativeNotificationSettings(body.settings),
  }
}
