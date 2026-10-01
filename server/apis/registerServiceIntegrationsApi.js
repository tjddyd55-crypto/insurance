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
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerServiceIntegrationsApi(apiRouter, { pool, requireAuth, handleDbError }) {
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
      const providers = SERVICE_PROVIDERS.map((provider) => {
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
    const provider = findServiceProvider(String(req.params.providerKey ?? ''))
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
    const provider = findServiceProvider(String(req.params.providerKey ?? ''))
    if (!provider) {
      res.status(404).json({ message: '연동 제공자를 찾을 수 없습니다.' })
      return
    }
    try {
      const scope = await resolveSmsAuthContext(pool, req)
      if (provider.kind === 'aligo') {
        await deleteAligoSmsSettings(pool, scope)
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
