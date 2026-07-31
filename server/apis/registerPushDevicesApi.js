import {
  registerUserPushDevice,
  unregisterUserPushDevice,
} from '../lib/push/pushDeviceService.js'
import { isFirebasePushConfigured, getFirebaseInitError } from '../lib/push/fcmClient.js'

/**
 * CRM Android push device registration.
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} deps
 */
export function registerPushDevicesApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.post('/push/devices/register', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' })
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const token = String(body.token ?? body.deviceToken ?? '').trim()
      const installationId = String(body.installationId ?? '').trim()
      const platform = String(body.platform ?? 'ANDROID').trim()
      const appVersion = body.appVersion != null ? String(body.appVersion) : null
      const appPackage = body.appPackage != null ? String(body.appPackage) : 'com.onefc.app'
      const gaId = req.user?.gaId ?? req.user?.ga_id ?? null

      const result = await registerUserPushDevice(pool, {
        userId,
        gaId,
        deviceToken: token,
        installationId,
        platform,
        appPackage,
        appVersion,
      })
      return res.json({
        ok: true,
        id: result.id,
        pushConfigured: isFirebasePushConfigured(),
      })
    } catch (error) {
      if (error?.status === 400) {
        return res.status(400).json({ message: error.message })
      }
      return handleDbError(error, req, res)
    }
  })

  apiRouter.post('/push/devices/unregister', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' })
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      await unregisterUserPushDevice(pool, {
        userId,
        installationId: body.installationId,
        deviceToken: body.token ?? body.deviceToken,
      })
      return res.json({ ok: true })
    } catch (error) {
      if (error?.status === 400) {
        return res.status(400).json({ message: error.message })
      }
      return handleDbError(error, req, res)
    }
  })

  apiRouter.get('/push/status', requireAuth, async (_req, res) => {
    return res.json({
      ok: true,
      pushConfigured: isFirebasePushConfigured(),
      initError: isFirebasePushConfigured() ? null : getFirebaseInitError(),
    })
  })
}
