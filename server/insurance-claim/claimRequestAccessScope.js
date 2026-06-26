import { parseGaId } from '../lib/parseGaId.js'

/**
 * @typedef {{ clause: string, params: unknown[] }} ClaimRequestScope
 */

/**
 * insurance_claim_requests 조회·변경 시 항상 로그인 유저 개인 범위만 허용한다.
 * GA tenant 공유(customerAccess=tenant)와 무관하며, 같은 GA 타 유저 청구는 노출하지 않는다.
 *
 * - customer_id 있음: COALESCE(owner_user_id, user_id)가 현재 유저인 고객에 연결된 청구만
 * - customer_id 없음(수동 입력): created_by가 현재 유저일 때만
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

  const gaPh = '$1'
  const userPh = '$2'
  /** @type {unknown[]} */
  const params = [gaId, userId]

  const customerLinked = `(r.customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM customers cust
    WHERE cust.id = r.customer_id
      AND cust.ga_id = ${gaPh}
      AND cust.deleted_at IS NULL
      AND COALESCE(cust.owner_user_id, cust.user_id) = ${userPh}
  ))`

  const userIdNum = Number(userId)
  const createdBy = Number.isInteger(userIdNum) && userIdNum >= 1 ? userIdNum : null
  if (createdBy == null) {
    return { clause: customerLinked, params }
  }

  const createdPh = '$3'
  params.push(createdBy)
  const orphanOwn = `(r.customer_id IS NULL AND r.created_by = ${createdPh})`
  return { clause: `(${customerLinked} OR ${orphanOwn})`, params }
}
