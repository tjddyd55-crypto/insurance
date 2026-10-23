import { parseGaId } from '../lib/parseGaId.js'
import {
  createOnefcSchedule,
  deleteOnefcSchedule,
  normalizeOnefcScheduleEvent,
  updateOnefcSchedule,
} from '../schedule/onefcSchedule.js'

const FIELD_MESSAGE = {
  title: '제목을 입력해 주세요.',
  description: '설명이 너무 깁니다.',
  date: '날짜를 확인해 주세요.',
  endDate: '종료일을 확인해 주세요.',
  startTime: '시작 시간을 확인해 주세요.',
  endTime: '종료 시간을 확인해 주세요.',
  requestId: '요청 번호가 올바르지 않습니다.',
  id: '일정을 찾을 수 없습니다.',
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    res.status(401).json({ success: false, code: 'unauthorized', message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ success: false, code: 'ga_required', message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {unknown} error
 * @param {import('express').Response} res
 * @param {Function} handleDbError
 * @param {import('express').Request} req
 */
function sendError(error, res, handleDbError, req) {
  const status = Number(error?.status)
  if (status === 400) {
    const field = String(error?.field ?? '')
    res.status(400).json({
      success: false,
      code: 'invalid_input',
      message: FIELD_MESSAGE[field] ?? '입력값을 확인해 주세요.',
    })
    return
  }
  if (status === 404) {
    res.status(404).json({ success: false, code: 'schedule_not_found', message: '일정을 찾을 수 없습니다.' })
    return
  }
  if (status === 409) {
    res.status(409).json({ success: false, code: 'schedule_conflict', message: '같은 요청을 저장할 수 없습니다.' })
    return
  }
  handleDbError(error, req, res)
}

/**
 * 사용자 소유 ONE FC 일정(calendar_items). Google 로 복사하지 않는다(자동 연동 미포함).
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerOnefcScheduleApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.post('/schedules', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) return
    try {
      const saved = await createOnefcSchedule(pool, scope, req.body ?? {})
      const status = saved.duplicate ? 200 : 201
      res.status(status).json({
        success: true,
        data: { event: normalizeOnefcScheduleEvent(saved.row), duplicate: saved.duplicate },
      })
    } catch (error) {
      sendError(error, res, handleDbError, req)
    }
  })

  apiRouter.patch('/schedules/:id', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) return
    try {
      const row = await updateOnefcSchedule(pool, { ...scope, id: req.params.id }, req.body ?? {})
      res.json({ success: true, data: { event: normalizeOnefcScheduleEvent(row) } })
    } catch (error) {
      sendError(error, res, handleDbError, req)
    }
  })

  apiRouter.delete('/schedules/:id', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) return
    try {
      await deleteOnefcSchedule(pool, { ...scope, id: req.params.id })
      res.json({ success: true, data: { deleted: true } })
    } catch (error) {
      sendError(error, res, handleDbError, req)
    }
  })
}
