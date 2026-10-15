import { deleteAligoSmsSettings, getSmsSettings } from '../sms/smsSettingsService.js'
import { resolveSmsAuthContext } from '../sms/smsScope.js'
import {
  findServiceProvider,
  mapAligoConnectionStatus,
  resolveConnectionStatus,
  resolveProviderAvailability,
  SERVICE_PROVIDERS,
} from '../integrations/providerRegistry.js'
import { disconnectUserIntegration, listUserIntegrationRows, SECRET_MASK } from '../integrations/integrationStore.js'
import { readGoogleIntegrationStatus } from '../integrations/googleCalendarAdapter.js'
import { GOOGLE_CALENDAR_CARD_KEY, isGoogleConnectAllowed, isGoogleDriveEnabled } from '../integrations/google/googleOAuthConfig.js'

const GOOGLE_DRIVE_CARD_KEY = 'google_drive'
import { disconnectGoogleForUser, registerGoogleIntegrationApi, startGoogleConnect } from './registerGoogleIntegrationApi.js'

const SECRET_BODY_KEYS = ['apiKey', 'api_key', 'secret', 'accessToken', 'refreshToken', 'password']

/**
 * @param {import('express').Response} res
 * @param {Error & { status?: number, publicMessage?: string }} error
 */
function sendKnownError(res, error) {
  const status = Number(error.status) || 500
  res.status(status).json({
    success: false,
    message: error.publicMessage || '연동 요청을 처리하지 못했습니다.',
    code: error.message,
  })
}

/**
 * @param {Record<string, unknown>} body
 */
function bodyHasSecret(body) {
  return SECRET_BODY_KEYS.some((key) => String(body[key] ?? '').trim())
}

/**
 * Google 카드(Calendar·Tasks)는 공용 Google 계정 행(provider_key='google')에서 상태를 읽는다. 항상 현재 사용자 행만.
 * @param {Awaited<ReturnType<typeof readGoogleIntegrationStatus>>} google
 * @returns {'connected' | 'disconnected' | 'error' | 'needs_reauth' | 'unconfigured'}
 */
/** t311: 서비스 연동 화면에 보여 줄 기능별 권한. */
function googleGrants(google) {
  return {
    calendarRead: Boolean(google.calendarReadable),
    tasksRead: Boolean(google.tasksReadable),
    writeEnabled: Boolean(google.write?.enabled),
    calendarWrite: Boolean(google.write?.calendarWritable),
    tasksWrite: Boolean(google.write?.tasksWritable),
    driveEnabled: Boolean(google.drive?.enabled),
    drive: Boolean(google.drive?.granted),
  }
}

function googleCardStatus(google) {
  if (!google.configured) {
    return 'unconfigured'
  }
  return google.status
}

/**
 * 'google' 도 Google Calendar 연결 요청으로 받는다.
 * @param {unknown} raw
 */
function resolveProviderParam(raw) {
  const key = String(raw ?? '')
  return findServiceProvider(key === 'google' ? GOOGLE_CALENDAR_CARD_KEY : key)
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerServiceIntegrationsApi(apiRouter, { pool, requireAuth, handleDbError }) {
  registerGoogleIntegrationApi(apiRouter, { pool, requireAuth, handleDbError })

  apiRouter.get('/service-integrations', requireAuth, async (req, res) => {
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      const rows = await listUserIntegrationRows(pool, scope.userId)
      const byKey = new Map(rows.map((row) => [row.provider_key, row]))
      let aligoSettings = null
      try {
        aligoSettings = await getSmsSettings(pool, scope)
      } catch (error) {
        if (!error?.status) {
          throw error
        }
      }
      const google = await readGoogleIntegrationStatus(pool, scope.userId)
      const providers = SERVICE_PROVIDERS.map((provider) => {
        if (provider.key === GOOGLE_CALENDAR_CARD_KEY) {
          return {
            key: provider.key,
            group: provider.group,
            groupLabel: provider.groupLabel,
            name: provider.name,
            description: provider.description,
            kind: provider.kind,
            availability: google.configured ? 'ready' : 'unconfigured',
            status: googleCardStatus(google),
            lastSyncedAt: google.lastFetchedAt,
            lastError: null,
            secretMasked: null,
            sender: '',
            accountLabel: google.accountEmail,
            connectedAt: google.connectedAt,
            settingsPath: null,
            products: google.products,
            needsReconsent: google.needsReconsent,
            connectAllowed: isGoogleConnectAllowed(req.user),
            // t311: 기능별 권한 상태(쓰기·Drive 는 플래그 ON 일 때만 의미가 있다)
            grants: googleGrants(google),
          }
        }
        if (provider.key === GOOGLE_DRIVE_CARD_KEY && isGoogleDriveEnabled()) {
          const connected = google.status === 'connected'
          return {
            key: provider.key,
            group: provider.group,
            groupLabel: provider.groupLabel,
            name: provider.name,
            description: 'Google Drive 에서 파일을 가져오고, 내 저장공간 파일 사본을 Drive 로 보냅니다(앱에서 고른 파일·폴더만 접근).',
            kind: 'oauth',
            availability: google.configured ? 'ready' : 'unconfigured',
            status: !google.configured ? 'unconfigured' : connected ? (google.drive.granted ? 'connected' : 'disconnected') : googleCardStatus(google),
            lastSyncedAt: null,
            lastError: null,
            secretMasked: null,
            sender: '',
            accountLabel: connected ? google.accountEmail : '',
            connectedAt: google.drive.granted ? google.connectedAt : null,
            settingsPath: null,
            connectAllowed: isGoogleConnectAllowed(req.user),
            grants: googleGrants(google),
          }
        }
        const availability = resolveProviderAvailability(provider, process.env)
        const stored = byKey.get(provider.key)
        const status = provider.kind === 'aligo'
          ? mapAligoConnectionStatus(aligoSettings ?? { configured: false })
          : resolveConnectionStatus(availability, stored?.status ?? null)
        return {
          key: provider.key,
          group: provider.group,
          groupLabel: provider.groupLabel,
          name: provider.name,
          description: provider.description,
          kind: provider.kind,
          availability,
          status,
          lastSyncedAt: provider.kind === 'aligo'
            ? aligoSettings?.lastBalanceCheckedAt ?? null
            : stored?.last_synced_at ?? null,
          lastError: stored?.last_error ?? null,
          secretMasked: stored?.has_secret ? SECRET_MASK : null,
          sender: provider.kind === 'aligo' ? aligoSettings?.defaultSender ?? '' : '',
          accountLabel: provider.kind === 'aligo' ? aligoSettings?.aligoUserId ?? '' : '',
          settingsPath: provider.kind === 'aligo' ? '/sms/settings' : null,
        }
      })
      res.json({ success: true, data: { providers } })
    } catch (error) {
      if (error?.status) {
        sendKnownError(res, error)
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/service-integrations/:providerKey/connect', requireAuth, async (req, res) => {
    const provider = resolveProviderParam(req.params.providerKey)
    if (!provider) {
      res.status(404).json({ message: '연동 제공자를 찾을 수 없습니다.' })
      return
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    if (bodyHasSecret(body)) {
      res.status(400).json({ message: '비밀 값은 이 요청으로 저장하지 않습니다.' })
      return
    }
    if (provider.kind === 'aligo') {
      res.json({ success: true, data: { action: 'open_settings', path: '/sms/settings' } })
      return
    }
    if (provider.key === GOOGLE_CALENDAR_CARD_KEY || (provider.key === GOOGLE_DRIVE_CARD_KEY && isGoogleDriveEnabled())) {
      try {
        // t311: 서비스 연동 화면이 유일한 연결 지점. 그 기능에 필요한 scope 를 한 번에 묻는다.
        const feature = provider.key === GOOGLE_DRIVE_CARD_KEY ? 'drive' : 'calendar'
        const google = await readGoogleIntegrationStatus(pool, String(req.user?.id ?? ''))
        const connected = google.status === 'connected'
        if (connected && feature === 'drive') {
          await startGoogleConnect(pool, req, res, { purpose: 'drive', returnTo: 'settings' })
        } else if (connected && feature === 'calendar' && google.write.enabled && google.write.needsWriteConsent && !google.needsReconsent) {
          await startGoogleConnect(pool, req, res, { purpose: 'write', returnTo: 'settings' })
        } else {
          await startGoogleConnect(pool, req, res, { feature })
        }
      } catch (error) {
        if (error?.status) {
          sendKnownError(res, error)
          return
        }
        handleDbError(error, req, res)
      }
      return
    }
    const availability = resolveProviderAvailability(provider, process.env)
    if (availability === 'unconfigured') {
      res.status(409).json({
        success: false,
        code: 'provider_unconfigured',
        message: '클라이언트 설정이 없어 연동할 수 없습니다.',
      })
      return
    }
    res.status(501).json({
      success: false,
      code: 'provider_oauth_not_implemented',
      message: 'OAuth 연결 절차는 아직 연결되어 있지 않습니다.',
    })
  })

  apiRouter.post('/service-integrations/:providerKey/disconnect', requireAuth, async (req, res) => {
    const provider = resolveProviderParam(req.params.providerKey)
    if (!provider) {
      res.status(404).json({ message: '연동 제공자를 찾을 수 없습니다.' })
      return
    }
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      if (provider.kind === 'aligo') {
        await deleteAligoSmsSettings(pool, scope)
      } else if (provider.key === GOOGLE_DRIVE_CARD_KEY && isGoogleDriveEnabled()) {
        // drive.file 만 따로 철회하는 Google API 는 없다. Google 연결 해제로 안내한다.
        res.status(409).json({ success: false, code: 'drive_disconnect_via_google', message: 'Drive 권한만 따로 해제할 수 없습니다. Google 연결 해제를 이용해 주세요.' })
        return
      } else if (provider.key === GOOGLE_CALENDAR_CARD_KEY) {
        await disconnectGoogleForUser(pool, { userId: scope.userId })
      } else {
        await disconnectUserIntegration(pool, scope.userId, provider.key)
      }
      res.json({ success: true })
    } catch (error) {
      if (error?.status) {
        sendKnownError(res, error)
        return
      }
      handleDbError(error, req, res)
    }
  })
}
