import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  buildCustomerMapListQuery,
  buildCustomerMapStatsQuery,
  formatLastConsultDate,
} from '../lib/customerMapQuery.js'

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

  apiRouter.get('/customers/map', requireAuth, async (req, res) => {
    try {
      const userId = requireInsuranceFormUserId(req, res)
      if (!userId) {
        return
      }
      const gaId = parseGaId(req.user?.gaId)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }

      const favoriteOnly =
        req.query.favoriteOnly === 'true' ||
        req.query.favoriteOnly === '1' ||
        req.query.favoriteOnly === 'yes'

      const listBuilt = buildCustomerMapListQuery({
        userId,
        gaId,
        boundsNorth: req.query.boundsNorth,
        boundsSouth: req.query.boundsSouth,
        boundsEast: req.query.boundsEast,
        boundsWest: req.query.boundsWest,
        centerLat: req.query.centerLat,
        centerLng: req.query.centerLng,
        radiusKm: req.query.radiusKm,
        favoriteOnly,
        keyword: req.query.keyword,
      })

      const statsBuilt = buildCustomerMapStatsQuery({ userId, gaId })

      const [listResult, statsResult] = await Promise.all([
        safeQuery(pool, listBuilt.sql, listBuilt.params),
        safeQuery(pool, statsBuilt.sql, statsBuilt.params),
      ])

      const statsRow = statsResult.rows[0] ?? {}
      const customers = listResult.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name ?? '').trim(),
        phone: String(row.phone ?? '').trim(),
        address: String(row.address ?? '').trim(),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        lastConsultDate: formatLastConsultDate(row.last_consult_date),
        isFavorite: row.is_favorite === true,
      }))

      res.json({
        customers,
        stats: {
          total: Number(statsRow.total ?? 0) || 0,
          withLocation: Number(statsRow.with_location ?? 0) || 0,
          missingAddress: Number(statsRow.missing_address ?? 0) || 0,
          geocodeFailed: Number(statsRow.geocode_failed ?? 0) || 0,
        },
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
