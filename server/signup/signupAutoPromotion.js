import { isInsuranceBillingEnabled } from '../insurance-billing/config.js'
import { loadPromotionCodeRow, validatePromotionCodeRow } from '../insurance-billing/promotionService.js'
import {
  applyFreeMonthsPromotion,
  recordBillingEvent,
} from '../insurance-billing/subscriptionLifecycle.js'
import { assertUserBillingPromotionNotAlreadyUsed } from '../insurance-billing/billingPromotionRedemptionPolicy.js'
import { getSignupAutoPromotionCode, isFreeLaunchGrantMode } from './freeLaunchPolicy.js'

/**
 * 신규 가입 system grant — SIGNUP_AUTO_PROMOTION_CODE env 기준.
 * 실패해도 가입 자체는 성공해야 하므로 throw 하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string; gaId?: number | null }} params
 */
export async function applySignupAutoPromotionOnSignup(executor, params) {
  const userId = String(params.userId ?? '').trim()
  if (!userId || !isFreeLaunchGrantMode()) {
    return { applied: false, reason: 'not_configured' }
  }

  const code = getSignupAutoPromotionCode()
  if (!code) {
    return { applied: false, reason: 'not_configured' }
  }

  if (!isInsuranceBillingEnabled()) {
    console.warn('[signupAutoPromotion] billing disabled — skip auto promotion')
    return { applied: false, reason: 'billing_disabled' }
  }

  try {
    await assertUserBillingPromotionNotAlreadyUsed(executor, userId)
  } catch {
    return { applied: false, reason: 'already_used' }
  }

  const row = await loadPromotionCodeRow(executor, { code })
  if (!row) {
    console.warn('[signupAutoPromotion] promotion row not found — skip')
    return { applied: false, reason: 'promo_not_found' }
  }

  const valid = validatePromotionCodeRow(row, {})
  if (!valid.valid) {
    console.warn('[signupAutoPromotion] promotion invalid — skip')
    return { applied: false, reason: 'promo_invalid' }
  }

  const client = typeof executor.connect === 'function' ? await executor.connect() : executor
  const ownsClient = typeof executor.connect === 'function'
  try {
    if (ownsClient) {
      await client.query('BEGIN')
    }
    await applyFreeMonthsPromotion(client, {
      userId,
      promotionRow: row,
    })
    await recordBillingEvent(client, {
      userId,
      eventType: 'subscription.launch_free.granted',
      payload: {
        subscriptionSource: 'launch_free',
        grantType: 'system_grant',
        promotionCodeId: row.id,
      },
    })
    if (ownsClient) {
      await client.query('COMMIT')
    }
    return { applied: true, promotionCodeId: row.id }
  } catch (error) {
    if (ownsClient) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* noop */
      }
    }
    console.warn('[signupAutoPromotion] apply failed — signup continues:', error?.message ?? error)
    return { applied: false, reason: 'apply_failed' }
  } finally {
    if (ownsClient) {
      client.release()
    }
  }
}
