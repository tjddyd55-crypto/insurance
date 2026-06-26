import { parseGaId } from '../lib/parseGaId.js'
import { resolveCustomerVisibilitySqlForSelect } from '../lib/customerRowVisibilitySql.js'

/**
 * @typedef {{ clause: string, params: unknown[] }} ClaimRequestScope
 */

/**
 * insurance_claim_requests 조회·변경 시 user/tenant customerAccess 를 반영한다.
 * - customer_id 있음: customers visibility 와 JOIN
 * - customer_id 없음(수동 입력): own 스코프는 created_by 일치만 허용
 *
 * @param {import('express').Request} req
 * @returns {ClaimRequestScope}
 */
export function buildClaimRequestScopeWhere(req) {
  const userId = req.user?.id ? String(req.user.id) : ''
  const gaId = parseGaId(req.user?.gaId)
  const access = req.user?.customerAccess ?? 'own'

  if (!userId || gaId == null || access === 'none' || access === 'assigned') {
    return { clause: '(FALSE)', params: [] }
  }

  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return { clause: '(FALSE)', params: [] }
  }

  const custVis = vis.clause.replace(/\bc\./g, 'cust.')
  /** @type {unknown[]} */
  const params = [...vis.params]
  const customerLinked = `(r.customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM customers cust
    WHERE cust.id = r.customer_id AND (${custVis})
  ))`

  if (access === 'own') {
    const userIdNum = Number(userId)
    const createdBy = Number.isInteger(userIdNum) && userIdNum >= 1 ? userIdNum : null
    if (createdBy == null) {
      return { clause: customerLinked, params }
    }
    const createdPh = `$${params.length + 1}`
    params.push(createdBy)
    const orphanOwn = `(r.customer_id IS NULL AND r.created_by = ${createdPh})`
    return { clause: `(${customerLinked} OR ${orphanOwn})`, params }
  }

  return { clause: `(r.customer_id IS NULL OR ${customerLinked})`, params }
}
