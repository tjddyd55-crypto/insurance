import { parseGaId } from '../lib/parseGaId.js'
import {
  buildTaDayPayload,
  getOrCreateTaSettings,
  getTaDayPayload,
  getTaWeekPayload,
  parseTaDailyTargetCount,
  resolveTaAuthContext,
  saveTaSettings,
  TA_DEFAULT_DAILY_TARGET,
  updateTaAssignmentStatus,
} from '../services/taCallService.js'
import { coerceDateOnlyString } from '../../shared/dateTimeKst.js'

function resolveGaIdStrict(req, res) {
  const gid = parseGaId(req.gaId ?? req.user?.gaId)
  if (gid == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 필요합니다.' })
    return null
  }
  return gid
}

function mapSettingsRow(row) {
  return {
    dailyTargetCount: Number(row?.daily_target_count ?? TA_DEFAULT_DAILY_TARGET),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

export function registerTaCallApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/ta/settings', requireAuth, async (req, res) => {
    try {
      const auth = resolveTaAuthContext(req)
      if (!auth) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      if (resolveGaIdStrict(req, res) == null) return
      const row = await getOrCreateTaSettings(pool, auth.userId)
      res.json(mapSettingsRow(row))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/ta/settings', requireAuth, async (req, res) => {
    try {
      const auth = resolveTaAuthContext(req)
      if (!auth) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = resolveGaIdStrict(req, res)
      if (gaId == null) return

      const parsed = parseTaDailyTargetCount(req.body?.dailyTargetCount)
      if (parsed == null) {
        res.status(400).json({ message: '하루 목표 전화 수는 1~50 사이 정수여야 합니다.' })
        return
      }

      const row = await saveTaSettings(pool, auth.userId, parsed)
      res.json(mapSettingsRow(row))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/ta/week', requireAuth, async (req, res) => {
    try {
      const auth = resolveTaAuthContext(req)
      if (!auth) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = resolveGaIdStrict(req, res)
      if (gaId == null) return

      const startRaw = coerceDateOnlyString(req.query?.startDate)
      const payload = await getTaWeekPayload(pool, req, auth.userId, gaId, startRaw || undefined)
      res.json(payload)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/ta/day', requireAuth, async (req, res) => {
    try {
      const auth = resolveTaAuthContext(req)
      if (!auth) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = resolveGaIdStrict(req, res)
      if (gaId == null) return

      const dateRaw = coerceDateOnlyString(req.query?.date)
      if (!dateRaw) {
        res.status(400).json({ message: 'date(YYYY-MM-DD)가 필요합니다.' })
        return
      }

      const payload = await getTaDayPayload(pool, req, auth.userId, gaId, dateRaw)
      res.json(payload)
    } catch (error) {
      if (String(error?.message ?? '') === 'INVALID_DATE') {
        res.status(400).json({ message: '유효한 날짜가 아닙니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/ta/assignments/:assignmentId/status', requireAuth, async (req, res) => {
    try {
      const auth = resolveTaAuthContext(req)
      if (!auth) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      if (resolveGaIdStrict(req, res) == null) return

      const status = String(req.body?.status ?? '').trim()
      const updated = await updateTaAssignmentStatus(pool, auth.userId, req.params.assignmentId, status)
      if (!updated) {
        res.status(404).json({ message: '배정 기록을 찾을 수 없습니다.' })
        return
      }
      res.json(updated)
    } catch (error) {
      if (String(error?.message ?? '') === 'INVALID_STATUS') {
        res.status(400).json({ message: '허용되지 않는 상태값입니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })
}

export { buildTaDayPayload }
