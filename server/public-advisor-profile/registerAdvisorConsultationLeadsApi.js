import {
  countNewAdvisorConsultationLeads,
  getAdvisorConsultationLeadForOwner,
  listAdvisorConsultationLeadsForOwner,
  patchAdvisorConsultationLeadForOwner,
} from './advisorConsultationLeadService.js'
import { isUuid } from '../public-inquiries/publicInquiryAdminValidation.js'

const INVALID_LEAD_ID = { message: '잘못된 상담 신청 ID입니다.' }
const INVALID_STATUS = { message: '상담 신청 상태가 올바르지 않습니다.' }

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
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/me/advisor-consultation-leads/:id', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!isUuid(req.params.id)) {
        res.status(400).json(INVALID_LEAD_ID)
        return
      }
      const lead = await getAdvisorConsultationLeadForOwner(pool, userId, req.params.id)
      if (!lead) {
        res.status(404).json({ message: '상담 신청을 찾을 수 없습니다.' })
        return
      }
      res.json({ item: lead })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/me/advisor-consultation-leads/:id', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!isUuid(req.params.id)) {
        res.status(400).json(INVALID_LEAD_ID)
        return
      }
      const status = bodyStatus(req.body)
      const result = await patchAdvisorConsultationLeadForOwner(pool, userId, req.params.id, { status })
      if (!result.ok) {
        if (result.code === 'not_found') {
          res.status(404).json({ message: '상담 신청을 찾을 수 없습니다.' })
          return
        }
        if (result.code === 'invalid_status') {
          res.status(400).json(INVALID_STATUS)
          return
        }
        res.status(400).json({ message: '변경할 내용이 없습니다.' })
        return
      }
      res.json({ item: result.lead })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}

function bodyStatus(body) {
  if (!body || typeof body !== 'object') return undefined
  return body.status ?? body.leadStatus
}
