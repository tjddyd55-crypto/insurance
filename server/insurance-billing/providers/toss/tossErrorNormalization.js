/**
 * Toss Payments 오류 → billing 공통 오류 코드.
 */

/**
 * @param {{ code?: string; message?: string } | null | undefined} tossError
 */
export function normalizeTossBillingError(tossError) {
  const code = String(tossError?.code ?? '').trim()
  const message = String(tossError?.message ?? '').trim()

  if (!code && !message) {
    return {
      code: 'toss_unknown_error',
      userMessage: '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      providerCode: null,
    }
  }

  const table = /** @type {Record<string, string>} */ ({
    REJECT_CARD_PAYMENT: '카드 결제가 거절되었습니다. 다른 카드로 시도해 주세요.',
    INVALID_CARD_EXPIRATION: '카드 유효기간이 올바르지 않습니다.',
    INVALID_CARD_NUMBER: '카드 번호가 올바르지 않습니다.',
    INVALID_API_KEY: '결제 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.',
    NOT_FOUND_BILLING_KEY: '등록된 결제수단을 찾을 수 없습니다. 결제수단을 다시 등록해 주세요.',
    ALREADY_PROCESSED_PAYMENT: '이미 처리된 결제입니다.',
    PROVIDER_ERROR: '결제사 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  })

  const userMessage = table[code] ?? message ?? '결제 처리에 실패했습니다.'

  return {
    code: code ? `toss_${code.toLowerCase()}` : 'toss_error',
    userMessage,
    providerCode: code || null,
  }
}

/**
 * @param {{ ok: boolean; status: number; json: Record<string, unknown> | null }} response
 */
export function normalizeTossApiFailure(response) {
  const tossError = response.json ?? {}
  return normalizeTossBillingError({
    code: typeof tossError.code === 'string' ? tossError.code : undefined,
    message: typeof tossError.message === 'string' ? tossError.message : undefined,
  })
}
