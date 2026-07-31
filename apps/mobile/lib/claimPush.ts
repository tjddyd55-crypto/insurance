import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Alert, Linking, Platform } from 'react-native'
import Constants from 'expo-constants'

const DEFAULT_API_ORIGIN = 'https://insurance-production-7bd8.up.railway.app'
const ANDROID_PACKAGE = 'com.onefc.app'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Foreground: in-app banner only (avoid double tray + banner where possible)
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export type ClaimPushData = {
  type?: string
  customerId?: string
  claimId?: string
  route?: string
  notificationId?: string
}

export function resolveApiOrigin(override?: string): string {
  const fromOverride = String(override ?? '').trim()
  const fromEnv = String(process.env.EXPO_PUBLIC_API_ORIGIN ?? '').trim()
  const origin = (fromOverride || fromEnv || DEFAULT_API_ORIGIN).replace(/\/+$/, '')
  return origin || DEFAULT_API_ORIGIN
}

export function buildClaimWebRoute(data: ClaimPushData | null | undefined): string | null {
  if (!data) return null
  if (data.route && data.route.startsWith('/customers/')) {
    return data.route
  }
  const customerId = Number(data.customerId)
  const claimId = Number(data.claimId)
  if (!Number.isInteger(customerId) || customerId < 1) return null
  const qs = new URLSearchParams()
  qs.set('customerId', String(customerId))
  if (Number.isInteger(claimId) && claimId > 0) {
    qs.set('claimId', String(claimId))
  }
  return `/customers/${customerId}/claim-requests?${qs.toString()}`
}

export function parseOneFcDeepLink(url: string): string | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  try {
    if (raw.startsWith('onefc://')) {
      const u = new URL(raw.replace('onefc://', 'https://onefc.local/'))
      const parts = u.pathname.split('/').filter(Boolean)
      // onefc://customers/{id}/claims/{claimId}
      if (parts[0] === 'customers' && parts[1]) {
        const customerId = Number(parts[1])
        const claimId =
          parts[2] === 'claims' || parts[2] === 'claim-requests' ? Number(parts[3]) : NaN
        return buildClaimWebRoute({
          customerId: String(customerId),
          claimId: Number.isInteger(claimId) ? String(claimId) : undefined,
        })
      }
    }
    if (raw.includes('/customers/') && raw.includes('claim-requests')) {
      const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'https://local')
      return `${u.pathname}${u.search}`
    }
  } catch {
    return null
  }
  return null
}

export function claimPushDataFromNotification(
  content: Notifications.NotificationContent | null | undefined,
): ClaimPushData | null {
  const data = (content?.data ?? {}) as Record<string, unknown>
  if (!data || typeof data !== 'object') return null
  return {
    type: data.type != null ? String(data.type) : undefined,
    customerId: data.customerId != null ? String(data.customerId) : undefined,
    claimId: data.claimId != null ? String(data.claimId) : undefined,
    route: data.route != null ? String(data.route) : undefined,
    notificationId: data.notificationId != null ? String(data.notificationId) : undefined,
  }
}

type PermissionSnapshot = {
  status: string
  canAskAgain?: boolean
}

function asPermissionSnapshot(value: unknown): PermissionSnapshot {
  const v = (value ?? {}) as { status?: string; canAskAgain?: boolean }
  return {
    status: String(v.status ?? ''),
    canAskAgain: v.canAskAgain !== false,
  }
}

export async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  void Device.isDevice
  const current = asPermissionSnapshot(await Notifications.getPermissionsAsync())
  if (current.status === 'granted') return true
  if (current.status === 'denied' && current.canAskAgain === false) return false
  const next = asPermissionSnapshot(await Notifications.requestPermissionsAsync())
  return next.status === 'granted'
}

/** Soft prompt once per process; never loops if user chooses Later or denies. */
let permissionPromptShownThisProcess = false

export function promptClaimNotificationPermissionOnce(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false)
  if (permissionPromptShownThisProcess) {
    return Notifications.getPermissionsAsync().then(
      (p) => asPermissionSnapshot(p).status === 'granted',
    )
  }
  permissionPromptShownThisProcess = true

  return new Promise((resolve) => {
    void Notifications.getPermissionsAsync().then((raw) => {
      const current = asPermissionSnapshot(raw)
      if (current.status === 'granted') {
        resolve(true)
        return
      }
      if (current.status === 'denied' && current.canAskAgain === false) {
        Alert.alert(
          '알림이 꺼져 있습니다',
          '고객의 새로운 보험 청구 알림을 받으려면 설정에서 알림을 허용해 주세요.',
          [
            { text: '닫기', style: 'cancel', onPress: () => resolve(false) },
            {
              text: '설정 열기',
              onPress: () => {
                void Linking.openSettings()
                resolve(false)
              },
            },
          ],
        )
        return
      }
      Alert.alert(
        '알림을 받아보세요',
        '고객의 새로운 보험 청구가 접수되면 바로 알려드립니다.',
        [
          { text: '나중에', style: 'cancel', onPress: () => resolve(false) },
          {
            text: '알림 허용',
            onPress: () => {
              void ensureAndroidNotificationPermission().then(resolve)
            },
          },
        ],
      )
    })
  })
}

export async function ensureClaimNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('claim_notifications', {
    name: '보험 청구 알림',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250],
  })
}

export async function getNativeDevicePushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync()
    const value = String(token?.data ?? '').trim()
    return value || null
  } catch {
    return null
  }
}

export function getInstallationId(): string {
  const fromExtra = String(
    (Constants.easConfig as { projectId?: string } | null)?.projectId ?? '',
  ).trim()
  const session = String(Constants.sessionId ?? '').trim()
  return `onefc-${fromExtra || 'local'}-${Device.osInternalBuildId || session || 'dev'}`
}

export async function registerPushDeviceWithServer(params: {
  authToken: string
  deviceToken: string
  apiOrigin?: string
}): Promise<boolean> {
  const authToken = String(params.authToken ?? '').trim()
  const deviceToken = String(params.deviceToken ?? '').trim()
  if (!authToken || !deviceToken) return false
  const origin = resolveApiOrigin(params.apiOrigin)
  const res = await fetch(`${origin}/backend/api/push/devices/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: deviceToken,
      platform: 'ANDROID',
      installationId: getInstallationId(),
      appPackage: ANDROID_PACKAGE,
      appVersion: String(Constants.expoConfig?.version ?? ''),
    }),
  })
  return res.ok
}

export async function unregisterPushDeviceWithServer(params: {
  authToken: string
  apiOrigin?: string
}): Promise<void> {
  const authToken = String(params.authToken ?? '').trim()
  if (!authToken) return
  const origin = resolveApiOrigin(params.apiOrigin)
  try {
    await fetch(`${origin}/backend/api/push/devices/unregister`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installationId: getInstallationId(),
      }),
    })
  } catch {
    /* ignore */
  }
}

export async function markNotificationReadRemote(params: {
  authToken: string
  notificationId: string
  apiOrigin?: string
}): Promise<void> {
  const authToken = String(params.authToken ?? '').trim()
  const notificationId = String(params.notificationId ?? '').trim()
  if (!authToken || !notificationId) return
  const origin = resolveApiOrigin(params.apiOrigin)
  try {
    await fetch(`${origin}/backend/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  } catch {
    /* ignore */
  }
}

export async function syncPushRegistrationAfterLogin(authToken: string): Promise<void> {
  if (Platform.OS !== 'android') return
  await ensureClaimNotificationChannel()
  const granted = await promptClaimNotificationPermissionOnce()
  if (!granted) return
  const deviceToken = await getNativeDevicePushToken()
  if (!deviceToken) return
  await registerPushDeviceWithServer({ authToken, deviceToken })
}
