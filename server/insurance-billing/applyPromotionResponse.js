/**
 * POST /api/billing/checkout/apply-promotion 성공 응답 shape (프론트 검증용 SSOT)
 *
 * @param {{ status: string; trialEndsAt: string; freeMonths: number }} applied
 * @param {{ code: string }} promotionRow
 */
export function buildApplyPromotionSuccessPayload(applied, promotionRow) {
  const trialEndsAt = String(applied.trialEndsAt ?? '').trim()
  const trialEndsAtDate = trialEndsAt.length >= 10 ? trialEndsAt.slice(0, 10) : trialEndsAt

  return {
    success: true,
    subscription: {
      status: applied.status,
      trialEndsAt: trialEndsAtDate,
    },
    promotion: {
      code: String(promotionRow?.code ?? '').trim(),
      freeMonths: applied.freeMonths,
    },
    ok: true,
    status: applied.status,
    trialEndsAt: applied.trialEndsAt,
    freeMonths: applied.freeMonths,
    message: `${applied.freeMonths}개월 무료 이용권이 적용되었습니다.`,
  }
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function isApplyPromotionTrialingSuccessPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const row = /** @type {Record<string, unknown>} */ (payload)
  if (row.success !== true && row.ok !== true) {
    return false
  }
  const subscription =
    row.subscription && typeof row.subscription === 'object'
      ? /** @type {Record<string, unknown>} */ (row.subscription)
      : null
  const status = String(subscription?.status ?? row.status ?? '').trim().toLowerCase()
  const trialEndsAt = String(subscription?.trialEndsAt ?? row.trialEndsAt ?? '').trim()
  return status === 'trialing' && trialEndsAt.length > 0
}
