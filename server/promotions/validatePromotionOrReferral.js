import { normalizePromotionCode } from './promotionCode.js'
import { validatePromotionCode } from './promotionService.js'
import { validateReferralCodeForSignup } from '../referrals/referralService.js'
import { normalizeReferralCode } from '../referrals/referralCode.js'

/**
 * @typedef {{
 *  ok: boolean;
 *  source: 'promotion_code' | 'legacy_referral';
 *  codeNormalized: string;
 *  message: string;
 *  promo?: import('./promotionService.js').PromotionCodeRow;
 *  legacy?: { referrerUserId: string; code: string };
 * }} ValidatePromotionOrReferralResult
 */

/**
 * 가입/결제 입력란에서 사용할 “추천/할인 코드” 검증.
 * 1) promotion_codes 우선
 * 2) 없으면 기존 referral_codes (legacy) 로 fallback
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} raw
 * @returns {Promise<ValidatePromotionOrReferralResult>}
 */
export async function validatePromotionOrReferralCode(executor, raw) {
  const codeNorm = normalizePromotionCode(raw)
  if (!codeNorm) {
    return { ok: true, source: 'promotion_code', codeNormalized: '', message: '' }
  }

  const promoCheck = await validatePromotionCode(executor, codeNorm)
  if (promoCheck.ok && promoCheck.promo) {
    return {
      ok: true,
      source: 'promotion_code',
      codeNormalized: promoCheck.promo.codeNormalized,
      promo: promoCheck.promo,
      message: '코드가 적용되었습니다.',
    }
  }
  if (!promoCheck.ok && promoCheck.reason !== 'not_found') {
    // 프로모션 코드가 DB에 존재하지만 사용 불가인 경우: legacy fallback 하지 않는다.
    return {
      ok: false,
      source: 'promotion_code',
      codeNormalized: codeNorm,
      message: promoCheck.message,
    }
  }

  // promotion_codes 에 없을 때만 legacy referral fallback
  const legacyNorm = normalizeReferralCode(codeNorm)
  const legacy = await validateReferralCodeForSignup(executor, legacyNorm)
  if (!legacy.ok) {
    return { ok: false, source: 'legacy_referral', codeNormalized: legacyNorm, message: legacy.message }
  }
  if (!legacy.referrerUserId || !legacy.code) {
    return { ok: true, source: 'legacy_referral', codeNormalized: legacyNorm, message: '' }
  }
  return {
    ok: true,
    source: 'legacy_referral',
    codeNormalized: legacy.code,
    legacy: { referrerUserId: legacy.referrerUserId, code: legacy.code },
    message: '추천 코드가 적용되었습니다.',
  }
}

