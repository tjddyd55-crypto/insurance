import {
  countNewAdvisorConsultationLeads,
  getAdvisorConsultationLeadForOwner,
  listAdvisorConsultationLeadsForOwner,
  patchAdvisorConsultationLeadForOwner,
} from './advisorConsultationLeadService.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerAdvisorConsultationLeadsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/me/advisor-consultation-leads', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const items = await listAdvisorConsultationLeadsForOwner(pool, userId)
      const newCount = await countNewAdvisorConsultationLeads(pool, userId)
      res.json({ items, newCount })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.get('/me/advisor-consultation-leads/:id', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const lead = await getAdvisorConsultationLeadForOwner(pool, userId, req.params.id)
      if (!lead) {
        res.status(404).json({ message: '상담 신청을 찾을 수 없습니다.' })
        return
      }
      res.json({ item: lead })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.patch('/me/advisor-consultation-leads/:id', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const status = bodyStatus(req.body)
      const result = await patchAdvisorConsultationLeadForOwner(pool, userId, req.params.id, { status })
      if (!result.ok) {
        if (result.code === 'not_found') {
          res.status(404).json({ message: '상담 신청을 찾을 수 없습니다.' })
          return
        }
        res.status(400).json({ message: '변경할 내용이 없습니다.' })
        return
      }
      res.json({ item: result.lead })
    } catch (e) {
      handleDbError(res, e)
    }
  })
}

function bodyStatus(body) {
  if (!body || typeof body !== 'object') return undefined
  return body.status ?? body.leadStatus
}
