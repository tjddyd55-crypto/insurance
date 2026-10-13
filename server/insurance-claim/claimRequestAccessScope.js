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

  // created_by는 users.id(text, UUID)와 같은 문자열 id를 저장한다.
  // NULL created_by(레거시 행)는 `=` 비교에서 절대 매칭되지 않으므로 누구에게도 추가 노출되지 않는다.
  // ::text 캐스트로 마이그레이션 전(INTEGER) 스키마에서도 쿼리가 실패하지 않는다.
  const orphanOwn = `(r.customer_id IS NULL AND r.created_by IS NOT NULL AND r.created_by::text = ${userPh})`
  return { clause: `(${customerLinked} OR ${orphanOwn})`, params }
}
