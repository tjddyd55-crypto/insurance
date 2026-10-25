import {
  CLIENT_TYPES,
  CLIENT_TYPE_UNKNOWN_LABEL,
  formatClientTypeLabel,
} from '@insurance-shared/clientAccessContext.js'
import { formatAdminUserLastLogin } from './adminUserPresentation'

/** 빈 값 표기 SSOT — `-` / `없음` 혼용 금지 */
export const ADMIN_ACCESS_UNKNOWN_LABEL: string = CLIENT_TYPE_UNKNOWN_LABEL
export const ADMIN_ACCESS_WEB_APP_VERSION_LABEL = '웹 (해당 없음)'

type AccessFields = {
  last_seen_at?: string | null
  last_login_at?: string | null
  last_client_type?: string | null
  last_device_model?: string | null
  last_app_version?: string | null
}

function hasValidDate(iso: string | null | undefined): iso is string {
  return Boolean(iso) && !Number.isNaN(new Date(String(iso)).getTime())
}

/** 일시 표시 (null/잘못된 값 → 미확인) */
export function formatAdminAccessTime(iso: string | null | undefined, compact = false): string {
  return hasValidDate(iso) ? formatAdminUserLastLogin(iso, compact) : ADMIN_ACCESS_UNKNOWN_LABEL
}

/**
 * 목록 "최근 접속": last_seen_at(실제 사용) 우선, 없으면 last_login_at + "(로그인 기준)".
 */
export function formatAdminUserRecentAccess(row: AccessFields, compact = false): string {
  if (hasValidDate(row.last_seen_at)) {
    return formatAdminUserLastLogin(row.last_seen_at, compact)
  }
  if (hasValidDate(row.last_login_at)) {
    return `${formatAdminUserLastLogin(row.last_login_at, compact)} (로그인 기준)`
  }
  return ADMIN_ACCESS_UNKNOWN_LABEL
}

export function isKnownClientType(clientType: string | null | undefined): boolean {
  return Boolean(clientType) && (CLIENT_TYPES as readonly string[]).includes(String(clientType))
}

export function formatAdminUserChannel(clientType: string | null | undefined): string {
  return formatClientTypeLabel(clientType ?? null)
}

/**
 * 기기 표시 (저장값은 그대로, 표시만 통일).
 * 웹: 서버 파싱값(예 "Windows · Chrome"), Windows 앱: "Windows PC", 네이티브: 저장 model.
 */
export function formatAdminUserDevice(
  model: string | null | undefined,
  clientType?: string | null,
): string {
  const v = String(model ?? '').trim()
  if (v) return v
  if (clientType === 'desktop_windows') return 'Windows PC'
  return ADMIN_ACCESS_UNKNOWN_LABEL
}

export function formatAdminUserAppVersion(
  clientType: string | null | undefined,
  version: string | null | undefined,
): string {
  const v = String(version ?? '').trim()
  if (v) return v.startsWith('v') ? v : `v${v}`
  if (clientType === 'web_desktop' || clientType === 'web_mobile') return ADMIN_ACCESS_WEB_APP_VERSION_LABEL
  return ADMIN_ACCESS_UNKNOWN_LABEL
}

/** 사용해 본 채널: 알려진 값만, 표준 순서, 중복 제거 */
export function listAdminUsedChannelLabels(clientTypes: readonly (string | null | undefined)[]): string[] {
  const set = new Set(clientTypes.filter(isKnownClientType).map(String))
  return (CLIENT_TYPES as readonly string[]).filter((t) => set.has(t)).map(formatAdminUserChannel)
}

export type AdminAccessHistoryRow = {
  createdAt: string
  clientType: string | null
  deviceModel: string | null
  appVersion: string | null
}

/**
 * 최근 접속 기록 표시용 분리 (API 20건 정책 유지, 프런트 표현만).
 * 채널이 확인된 행은 원래 순서(최신순) 그대로, 채널 미확인 행은 개수만 요약.
 */
export function splitAdminAccessHistory<T extends AdminAccessHistoryRow>(rows: readonly T[]) {
  const known: T[] = []
  let unknownCount = 0
  for (const r of rows) {
    if (isKnownClientType(r.clientType)) known.push(r)
    else unknownCount += 1
  }
  return { known, unknownCount }
}

export function formatAdminUnknownHistorySummary(unknownCount: number, hasKnown: boolean): string {
  if (unknownCount <= 0) return ''
  return hasKnown
    ? `이전 기록 ${unknownCount}건은 접속 채널 정보가 없습니다.`
    : `기록 ${unknownCount}건 모두 접속 채널 정보가 없습니다.`
}
