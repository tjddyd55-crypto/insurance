import { parseGaId } from '../lib/parseGaId.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { assertCustomerRowAccessibleByVisibility } from '../lib/customerRowVisibilitySql.js'
import { createPgGateway } from '../schedule/googleSyncV2/calendarItemGateway.js'
import { isOnefcGoogleSyncV2Enabled } from '../schedule/googleSyncV2/flag.js'
import { CalendarItemInputError } from '../schedule/googleSyncV2/calendarItemInput.js'
import {
  createCalendarItem,
  deleteCalendarItem,
  getCalendarItem,
  listCalendarItems,
  updateCalendarItem,
} from '../schedule/googleSyncV2/calendarItemStore.js'

const ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /api/calendar-items. 플래그가 꺼져 있으면 라우트가 없는 것과 같이 404.
 * 소유자는 매 요청의 로그인 사용자로만 다시 확인한다.
 * Google push 는 넘기지 않는다. 실패가 로컬 저장을 막지 않도록 저장소가 커밋 이후에만 받는다.
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool?: import('pg').Pool,
 *   gateway?: { transaction: Function, query: Function },
 *   requireAuth: import('express').RequestHandler,
 *   handleDbError: Function,
 *   env?: NodeJS.ProcessEnv,
 *   assertCustomerAccessible?: Function,
 *   pushGoogle?: Function,
 * }} deps
 */
export function registerCalendarItemsApi(apiRouter, deps) {
  const gateway = deps.gateway ?? createPgGateway(deps.pool)
  apiRouter.get('/calendar-items', deps.requireAuth, (req, res) => handleList(deps, gateway, req, res))
  apiRouter.post('/calendar-items', deps.requireAuth, (req, res) => handleCreate(deps, gateway, req, res))
  apiRouter.get('/calendar-items/:id', deps.requireAuth, (req, res) => handleGet(deps, gateway, req, res))
  apiRouter.patch('/calendar-items/:id', deps.requireAuth, (req, res) => handlePatch(deps, gateway, req, res))
  apiRouter.delete('/calendar-items/:id', deps.requireAuth, (req, res) => handleDelete(deps, gateway, req, res))
}

/**
 * @param {{ env?: NodeJS.ProcessEnv }} deps
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readActor(deps, req, res) {
  if (!isOnefcGoogleSyncV2Enabled(deps.env)) {
    res.status(404).json({ success: false, code: 'not_found', message: '요청한 기능을 찾을 수 없습니다.' })
    return null
  }
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    res.status(401).json({ success: false, code: 'unauthorized', message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId ?? req.gaId)
  if (gaId == null) {
    res.status(400).json({ success: false, code: 'ga_required', message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {Function} handleDbError
 * @param {import('express').Request} req
 */
function sendFailure(res, error, handleDbError, req) {
  if (error instanceof CalendarItemInputError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message })
    return
  }
  const code = error?.code
  if (code === 'invalid_range' || code === 'range_too_wide') {
    res.status(400).json({ success: false, code, message: '조회 기간이 올바르지 않습니다.' })
    return
  }
  handleDbError(error, req, res)
}

/**
 * @param {any} deps
 * @param {import('express').Request} req
 * @param {number | null} customerId
 */
async function customerAllowed(deps, req, customerId) {
  if (customerId == null) return true
  const assertAccess = deps.assertCustomerAccessible
    ?? ((request, id) => assertCustomerRowAccessibleByVisibility(deps.pool, safeQuery, request, id))
  return Boolean(await assertAccess(req, customerId))
}

/**
 * @param {Record<string, unknown>} body
 */
function customerIdFromBody(body) {
  if (!body || typeof body !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(body, 'customerId')) return body.customerId
  if (Object.prototype.hasOwnProperty.call(body, 'customer_id')) return body.customer_id
  return undefined
}

/**
 * @param {any} deps
 * @param {any} gateway
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleList(deps, gateway, req, res) {
  const actor = readActor(deps, req, res)
  if (!actor) return
  try {
    const items = await listCalendarItems(gateway, actor, {
      fromYmd: String(req.query.from ?? '').trim(),
      toYmd: String(req.query.to ?? '').trim(),
    })
    res.json({ success: true, data: { items } })
  } catch (error) {
    sendFailure(res, error, deps.handleDbError, req)
  }
}

/**
 * @param {any} deps
 * @param {any} gateway
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleCreate(deps, gateway, req, res) {
  const actor = readActor(deps, req, res)
  if (!actor) return
  try {
    const body = req.body ?? {}
    if (!(await customerAllowed(deps, req, normalizeCustomerProbe(customerIdFromBody(body))))) {
      res.status(403).json({ success: false, code: 'customer_forbidden', message: '해당 고객에 대한 접근 권한이 없습니다.' })
      return
    }
    const saved = await createCalendarItem(gateway, actor, body, { pushGoogle: deps.pushGoogle })
    res.status(saved.wrote ? 201 : 200).json({ success: true, data: { item: saved.item, idempotent: !saved.wrote } })
  } catch (error) {
    sendFailure(res, error, deps.handleDbError, req)
  }
}

/**
 * 고객 연결이 있을 때만 권한을 확인한다. 형식 오류는 저장소 검증에 맡긴다.
 * @param {unknown} value
 */
function normalizeCustomerProbe(value) {
  if (value == null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readItemId(req, res) {
  const id = String(req.params.id ?? '').trim()
  if (!ITEM_ID.test(id)) {
    res.status(404).json({ success: false, code: 'not_found', message: '일정을 찾을 수 없습니다.' })
    return null
  }
  return id
}

/**
 * @param {any} deps
 * @param {any} gateway
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleGet(deps, gateway, req, res) {
  const actor = readActor(deps, req, res)
  if (!actor) return
  const id = readItemId(req, res)
  if (!id) return
  try {
    const item = await getCalendarItem(gateway, actor, id)
    res.json({ success: true, data: { item } })
  } catch (error) {
    sendFailure(res, error, deps.handleDbError, req)
  }
}

/**
 * @param {any} deps
 * @param {any} gateway
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handlePatch(deps, gateway, req, res) {
  const actor = readActor(deps, req, res)
  if (!actor) return
  const id = readItemId(req, res)
  if (!id) return
  try {
    const body = req.body ?? {}
    if (!(await customerAllowed(deps, req, normalizeCustomerProbe(customerIdFromBody(body))))) {
      res.status(403).json({ success: false, code: 'customer_forbidden', message: '해당 고객에 대한 접근 권한이 없습니다.' })
      return
    }
    const saved = await updateCalendarItem(gateway, actor, id, body, { pushGoogle: deps.pushGoogle })
    res.json({ success: true, data: { item: saved.item, idempotent: !saved.wrote } })
  } catch (error) {
    sendFailure(res, error, deps.handleDbError, req)
  }
}

/**
 * @param {any} deps
 * @param {any} gateway
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleDelete(deps, gateway, req, res) {
  const actor = readActor(deps, req, res)
  if (!actor) return
  const id = readItemId(req, res)
  if (!id) return
  try {
    const saved = await deleteCalendarItem(gateway, actor, id, { pushGoogle: deps.pushGoogle })
    res.json({ success: true, data: { item: saved.item } })
  } catch (error) {
    sendFailure(res, error, deps.handleDbError, req)
  }
}
