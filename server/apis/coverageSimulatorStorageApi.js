import {
  createCoverageSimulation,
  createCoverageTemplate,
  deleteCoverageSimulation,
  deleteCoverageTemplate,
  duplicateCoverageTemplate,
  getCoverageSimulationById,
  getCoverageTemplateById,
  listCoverageSimulations,
  listCoverageTemplates,
  resolveCoverageStorageOwner,
  updateCoverageSimulation,
  updateCoverageTemplate,
} from '../coverage-simulator/coverageSimulatorStorageService.js'

function sendStorageError(res, error) {
  if (error?.httpStatus) {
    res.status(error.httpStatus).json({
      code: error.code ?? 'COVERAGE_ERROR',
      message: error.message,
    })
    return
  }
  return false
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: Function; handleDbError: Function }} ctx
 */
export function registerCoverageSimulatorStorageApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/coverage-simulator/templates', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const rows = await listCoverageTemplates(pool, owner)
      res.json({ templates: rows })
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/coverage-simulator/templates', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const row = await createCoverageTemplate(pool, req, owner, req.body ?? {})
      res.status(201).json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/coverage-simulator/templates/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      const row = await getCoverageTemplateById(pool, owner, id)
      if (!row) {
        res.status(404).json({ code: 'COVERAGE_TEMPLATE_NOT_FOUND', message: '시나리오를 찾을 수 없습니다.' })
        return
      }
      res.json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/coverage-simulator/templates/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      const row = await updateCoverageTemplate(pool, req, owner, id, req.body ?? {})
      res.json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/coverage-simulator/templates/:id/duplicate', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      const row = await duplicateCoverageTemplate(pool, owner, id)
      res.status(201).json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/coverage-simulator/templates/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      await deleteCoverageTemplate(pool, owner, id)
      res.json({ ok: true })
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/coverage-simulator/simulations', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : ''
      const diseaseType = typeof req.query.diseaseType === 'string' ? req.query.diseaseType.trim() : ''
      const rows = await listCoverageSimulations(pool, owner, {
        customerId: customerId || undefined,
        diseaseType: diseaseType || undefined,
      })
      res.json({ simulations: rows })
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/coverage-simulator/simulations', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const row = await createCoverageSimulation(pool, req, owner, req.body ?? {})
      res.status(201).json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/coverage-simulator/simulations/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      const row = await getCoverageSimulationById(pool, owner, id)
      if (!row) {
        res
          .status(404)
          .json({ code: 'COVERAGE_SIMULATION_NOT_FOUND', message: '저장된 시뮬레이션을 찾을 수 없습니다.' })
        return
      }
      res.json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/coverage-simulator/simulations/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      const row = await updateCoverageSimulation(pool, req, owner, id, req.body ?? {})
      res.json(row)
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/coverage-simulator/simulations/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveCoverageStorageOwner(req, res)
      if (!owner) return
      const id = String(req.params.id ?? '').trim()
      await deleteCoverageSimulation(pool, owner, id)
      res.json({ ok: true })
    } catch (error) {
      if (sendStorageError(res, error)) return
      handleDbError(error, req, res)
    }
  })
}
