import {
  completeContractMonth,
  createContract,
  createPaymentCard,
  deleteContract,
  deletePaymentCard,
  listCardPaymentContractsOverview,
  listContractsForCustomer,
  listPaymentCardsForCustomer,
  reopenContractMonth,
  updateContract,
  updatePaymentCard,
} from './lib/cardPaymentService.js'

/**
 * @param {import('express').Response} res
 */
function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parsePositiveInt(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    return null
  }
  return n
}

/**
 * 카드 수납 API — 고객 카드정보 / 수납 대상 / 월별 완료 / 전체 목록
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: Function; handleDbError: Function }} deps
 */
export function registerCardPaymentApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.get('/customers/:customerId/payment-cards', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        return res.status(400).json({ message: '고객 ID가 올바르지 않습니다.' })
      }
      const result = await listPaymentCardsForCustomer(pool, req, customerId)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.json({ cards: result.cards })
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/payment-cards', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        return res.status(400).json({ message: '고객 ID가 올바르지 않습니다.' })
      }
      const result = await createPaymentCard(pool, req, customerId, req.body)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.status(201).json(result.card)
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/customers/:customerId/payment-cards/:cardId', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      const cardId = parsePositiveInt(req.params.cardId)
      if (customerId == null || cardId == null) {
        return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
      }
      const result = await updatePaymentCard(pool, req, customerId, cardId, req.body)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.json(result.card)
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/customers/:customerId/payment-cards/:cardId', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      const cardId = parsePositiveInt(req.params.cardId)
      if (customerId == null || cardId == null) {
        return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
      }
      const result = await deletePaymentCard(pool, req, customerId, cardId)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.json({ ok: true })
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/:customerId/card-payment-contracts', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        return res.status(400).json({ message: '고객 ID가 올바르지 않습니다.' })
      }
      const result = await listContractsForCustomer(pool, req, customerId, req.query.month)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.json({ targetMonth: result.targetMonth, contracts: result.contracts })
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/card-payment-contracts', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        return res.status(400).json({ message: '고객 ID가 올바르지 않습니다.' })
      }
      const result = await createContract(pool, req, customerId, req.body)
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.status(201).json(result.contract)
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })

  apiRouter.patch(
    '/customers/:customerId/card-payment-contracts/:contractId',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const customerId = parsePositiveInt(req.params.customerId)
        const contractId = parsePositiveInt(req.params.contractId)
        if (customerId == null || contractId == null) {
          return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
        }
        const result = await updateContract(pool, req, customerId, contractId, req.body)
        if ('error' in result) {
          return res.status(result.error.status).json({ message: result.error.message })
        }
        return res.json(result.contract)
      } catch (error) {
        return handleDbError(error, req, res)
      }
    },
  )

  apiRouter.delete(
    '/customers/:customerId/card-payment-contracts/:contractId',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const customerId = parsePositiveInt(req.params.customerId)
        const contractId = parsePositiveInt(req.params.contractId)
        if (customerId == null || contractId == null) {
          return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
        }
        const result = await deleteContract(pool, req, customerId, contractId)
        if ('error' in result) {
          return res.status(result.error.status).json({ message: result.error.message })
        }
        return res.json({ ok: true })
      } catch (error) {
        return handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post(
    '/customers/:customerId/card-payment-contracts/:contractId/complete',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const customerId = parsePositiveInt(req.params.customerId)
        const contractId = parsePositiveInt(req.params.contractId)
        if (customerId == null || contractId == null) {
          return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
        }
        const result = await completeContractMonth(pool, req, customerId, contractId, req.body)
        if ('error' in result) {
          return res.status(result.error.status).json({ message: result.error.message })
        }
        return res.json({
          targetMonth: result.targetMonth,
          contract: result.contract,
        })
      } catch (error) {
        return handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post(
    '/customers/:customerId/card-payment-contracts/:contractId/reopen',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const customerId = parsePositiveInt(req.params.customerId)
        const contractId = parsePositiveInt(req.params.contractId)
        if (customerId == null || contractId == null) {
          return res.status(400).json({ message: '요청 값이 올바르지 않습니다.' })
        }
        const result = await reopenContractMonth(pool, req, customerId, contractId, {
          ...req.body,
          setPending: true,
        })
        if ('error' in result) {
          return res.status(result.error.status).json({ message: result.error.message })
        }
        return res.json({
          targetMonth: result.targetMonth,
          contract: result.contract,
        })
      } catch (error) {
        return handleDbError(error, req, res)
      }
    },
  )

  apiRouter.get('/card-payment-contracts', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const result = await listCardPaymentContractsOverview(pool, req, {
        month: req.query.month,
        status: req.query.status,
        search: req.query.search ?? req.query.q,
        insuranceCompany: req.query.insuranceCompany,
        paymentDay: req.query.paymentDay,
        ownerUserId: req.query.ownerUserId,
        limit: req.query.limit,
        offset: req.query.offset,
      })
      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message })
      }
      return res.json(result)
    } catch (error) {
      return handleDbError(error, req, res)
    }
  })
}
