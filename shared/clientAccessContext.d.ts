export type ClientType =
  | 'web_desktop'
  | 'web_mobile'
  | 'desktop_windows'
  | 'native_android'
  | 'native_ios'
export type ClientPlatform = 'android' | 'ios' | 'windows'
export type ClientContext = {
  clientType: ClientType | null
  platform: ClientPlatform | null
  deviceModel: string | null
  appVersion: string | null
  userAgent: string | null
}
export const CLIENT_TYPES: readonly ClientType[]
export const CLIENT_TYPE_LABELS: Readonly<Record<ClientType, string>>
export const CLIENT_TYPE_UNKNOWN_LABEL: string
export const CLIENT_PLATFORMS: readonly ClientPlatform[]
export const ONEFC_CLIENT_HEADERS: Readonly<{
  clientType: string
  appVersion: string
  deviceModel: string
  platform: string
}>
export const ACCESS_LAST_SEEN_THROTTLE_MS: number
export const CLIENT_APP_VERSION_MAX_LENGTH: number
export const CLIENT_DEVICE_MODEL_MAX_LENGTH: number
export const CLIENT_USER_AGENT_MAX_LENGTH: number
export const DESKTOP_WINDOWS_DEVICE_MODEL: string
export function normalizeClientType(raw: unknown): ClientType | null
export function normalizeClientPlatform(raw: unknown): ClientPlatform | null
export function normalizeClientAppVersion(raw: unknown): string | null
export function normalizeClientDeviceModel(raw: unknown): string | null
export function platformForClientType(clientType: string | null | undefined): ClientPlatform | null
export function resolveWebClientTypeFromUserAgent(ua: unknown): ClientType | null
export function resolvePlatformFromUserAgent(ua: unknown): ClientPlatform | null
export function describeWebDeviceFromUserAgent(ua: unknown): string | null
export function resolveClientContextFromHeaders(
  headers: Record<string, string | string[] | undefined> | null | undefined,
): ClientContext
export function formatClientTypeLabel(clientType: string | null | undefined): string
