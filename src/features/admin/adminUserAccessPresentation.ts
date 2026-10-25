import { formatClientTypeLabel } from '@insurance-shared/clientAccessContext.js'
import { formatAdminUserLastLogin } from './adminUserPresentation'

type AccessFields = {
  last_seen_at?: string | null
  last_login_at?: string | null
  last_client_type?: string | null
  last_device_model?: string | null
  last_app_version?: string | null
}

/**
 * 최근 접속: last_seen_at(실제 사용) 우선, 없으면 last_login_at 으로 대체하고 "(로그인 기준)" 표기.
 * 둘 다 없으면 "접속 기록 없음".
 */
export function formatAdminUserRecentAccess(row: AccessFields, compact = false): string {
  if (row.last_seen_at) {
    return formatAdminUserLastLogin(row.last_seen_at, compact)
  }
  if (row.last_login_at) {
    return `${formatAdminUserLastLogin(row.last_login_at, compact)} (로그인 기준)`
  }
  return '접속 기록 없음'
}

export function formatAdminUserChannel(clientType: string | null | undefined): string {
  return formatClientTypeLabel(clientType ?? null)
}

export function formatAdminUserDevice(model: string | null | undefined): string {
  const v = String(model ?? '').trim()
  return v || '미확인'
}

export function formatAdminUserAppVersion(
  clientType: string | null | undefined,
  version: string | null | undefined,
): string {
  const v = String(version ?? '').trim()
  if (v) return `v${v}`
  if (clientType === 'web_desktop' || clientType === 'web_mobile') return '웹 (해당 없음)'
  return '미확인'
}
