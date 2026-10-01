import { parseGaId } from '../lib/parseGaId.js'
import { loadCustomerRegionList, loadCustomerRegionOptions } from '../customers/customerRegionQuery.js'

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerCustomerRegionApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.get('/customers/regions/options', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) {
      return
    }
    try {
      const options = await loadCustomerRegionOptions(pool, {
        ...scope,
        sido: String(req.query.sido ?? ''),
        sigungu: String(req.query.sigungu ?? ''),
      })
      res.json({ success: true, data: options })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/regions', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) {
      return
    }
    try {
      const customers = await loadCustomerRegionList(pool, {
        ...scope,
        sido: String(req.query.sido ?? ''),
        sigungu: String(req.query.sigungu ?? ''),
        eupmyeondong: String(req.query.eupmyeondong ?? ''),
        query: String(req.query.q ?? ''),
        sort: String(req.query.sort ?? 'name'),
      })
      res.json({ success: true, data: { customers } })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
