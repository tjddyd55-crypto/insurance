import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  buildCustomerMapListQuery,
  buildCustomerMapStatsQuery,
} from '../lib/customerMapQuery.js'
import {
  buildCustomerMapResponse,
  mapCustomerMapRow,
  parseCustomerMapFilters,
} from '../lib/customerMapService.js'
import { resolveCustomerVisibilitySqlForSelect } from '../lib/customerRowVisibilitySql.js'
import { fetchNaverStaticMapImage } from '../lib/customerStaticMapBuilder.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool
 *   requireAuth: import('express').RequestHandler
 *   handleDbError: (err: unknown, req: import('express').Request, res: import('express').Response) => void
 *   requireInsuranceFormUserId: (req: import('express').Request, res: import('express').Response) => string | null
 * }} ctx
 */
export function registerCustomerMapApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError, requireInsuranceFormUserId } = ctx

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  function resolveMapVisibility(req, res, userId, gaId) {
    const accessEarly = req.user?.customerAccess ?? 'own'
    if (accessEarly === 'none') {
      return { blocked: true, empty: true }
    }
    const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
    if (vis.blocked) {
      return { blocked: true, empty: true }
    }
    return {
      blocked: false,
      empty: false,
      visibilityClause: vis.clause,
      visibilityParams: vis.params,
    }
  }

  async function loadCustomerMapData(req, res) {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return null
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return null
    }

    const visibility = resolveMapVisibility(req, res, userId, gaId)
    if (visibility.blocked) {
      return {
        filters: parseCustomerMapFilters(req.query),
        payload: buildCustomerMapResponse([], { statsRow: {} }),
      }
    }

    const filters = parseCustomerMapFilters(req.query)
    const listBuilt = buildCustomerMapListQuery({
      visibilityClause: visibility.visibilityClause,
      visibilityParams: visibility.visibilityParams,
      userId,
      gaId,
      boundsNorth: filters.boundsNorth,
      boundsSouth: filters.boundsSouth,
      boundsEast: filters.boundsEast,
      boundsWest: filters.boundsWest,
      centerLat: filters.useExplicitCenter ? filters.centerLat : undefined,
      centerLng: filters.useExplicitCenter ? filters.centerLng : undefined,
      radiusKm: filters.useExplicitCenter ? filters.radiusKm : undefined,
      favoriteOnly: filters.favoriteOnly,
      keyword: filters.keyword,
    })

    const statsBuilt = buildCustomerMapStatsQuery({
      visibilityClause: visibility.visibilityClause,
      visibilityParams: visibility.visibilityParams,
    })
    const [listResult, statsResult] = await Promise.all([
      safeQuery(pool, listBuilt.sql, listBuilt.params),
      safeQuery(pool, statsBuilt.sql, statsBuilt.params),
    ])

    const customers = listResult.rows.map(mapCustomerMapRow)
    return {
      filters,
      payload: buildCustomerMapResponse(customers, {
        centerLat: filters.centerLat,
        centerLng: filters.centerLng,
        radiusKm: filters.radiusKm,
        useExplicitCenter: filters.useExplicitCenter,
        statsRow: statsResult.rows[0] ?? {},
      }),
    }
  }

  apiRouter.get('/customers/map', requireAuth, async (req, res) => {
    try {
      const loaded = await loadCustomerMapData(req, res)
      if (!loaded) {
        return
      }
      res.json(loaded.payload)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/map/static-image', requireAuth, async (req, res) => {
    try {
      const loaded = await loadCustomerMapData(req, res)
      if (!loaded) {
        return
      }

      const { mapCustomers, staticMap } = loaded.payload
      if (!staticMap.configured) {
        res.status(503).json({ message: '지도 설정이 필요합니다. NAVER_MAPS_CLIENT_ID/SECRET을 확인해 주세요.' })
        return
      }
      if (mapCustomers.length === 0) {
        res.status(404).json({ message: '지도에 표시할 고객 좌표가 없습니다.' })
        return
      }

      const image = await fetchNaverStaticMapImage(mapCustomers, {
        centerLat: loaded.filters.centerLat,
        centerLng: loaded.filters.centerLng,
        radiusKm: loaded.filters.radiusKm,
        useExplicitCenter: loaded.filters.useExplicitCenter,
      })

      if (!image.ok) {
        res.status(502).json({ message: 'Static Map 이미지를 생성하지 못했습니다.', code: image.error })
        return
      }

      res.setHeader('Content-Type', image.contentType)
      res.setHeader('Cache-Control', 'private, max-age=60')
      res.send(image.buffer)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
