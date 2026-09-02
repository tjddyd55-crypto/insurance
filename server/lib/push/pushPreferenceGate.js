/**
 * App Push delivery gate — preference SSOT from user_notification_settings.
 * In-app notification rows are independent; this only decides whether to enqueue FCM.
 */

/**
 * @typedef {'new_customer' | 'claim' | 'customer_app_file' | 'work'} AppPushEventKind
 */

/**
 * @param {{
 *   appPush?: { enabled?: boolean }
 *   newCustomer?: { enabled?: boolean }
 *   claimRequest?: { enabled?: boolean }
 *   customerAppFile?: { enabled?: boolean }
 *   workAlert?: { enabled?: boolean }
 * } | null | undefined} settings
 * @param {AppPushEventKind} eventKind
 * @returns {boolean}
 */
export function shouldDeliverAppPush(settings, eventKind) {
  if (!settings || settings.appPush?.enabled === false) {
    return false
  }
  if (eventKind === 'new_customer') {
    return settings.newCustomer?.enabled !== false
  }
  if (eventKind === 'claim') {
    return settings.claimRequest?.enabled !== false
  }
  if (eventKind === 'customer_app_file') {
    return settings.customerAppFile?.enabled !== false
  }
  if (eventKind === 'work') {
    return settings.workAlert?.enabled !== false
  }
  return false
}

/**
 * Claim / file / inquiry events share one claim-request API.
 * @param {{ hasFiles?: boolean, submissionKind?: string | null }} input
 * @returns {AppPushEventKind}
 */
export function resolveClaimPushEventKind(input) {
  if (input?.hasFiles) {
    return 'customer_app_file'
  }
  const kind = String(input?.submissionKind ?? '').trim().toUpperCase()
  if (kind.includes('FILE') || kind.includes('INQUIRY')) {
    return 'customer_app_file'
  }
  return 'claim'
}
