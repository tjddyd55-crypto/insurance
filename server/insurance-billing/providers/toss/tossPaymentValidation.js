/**
 * Toss Payment 객체와 local billing_payments expected 값 대조.
 */

/**
 * @param {unknown} tossPayment
 * @param {{ orderId: string; totalAmount: number }} expected
 */
export function validateTossPaymentAgainstExpected(tossPayment, expected) {
  if (!tossPayment || typeof tossPayment !== 'object') {
    return { ok: false, reason: 'provider_payload_missing' }
  }
  const row = /** @type {{ status?: unknown; orderId?: unknown; totalAmount?: unknown; amount?: unknown; paymentKey?: unknown }} */ (
    tossPayment
  )
  const status = String(row.status ?? '').trim().toUpperCase()
  if (status !== 'DONE') {
    return { ok: false, reason: 'provider_not_paid', providerStatus: status || null }
  }

  const providerOrderId = String(row.orderId ?? '').trim()
  const expectedOrderId = String(expected.orderId ?? '').trim()
  if (!providerOrderId || providerOrderId !== expectedOrderId) {
    return {
      ok: false,
      reason: 'order_mismatch',
      providerOrderId: providerOrderId || null,
      expectedOrderId,
    }
  }

  const providerAmountRaw = row.totalAmount ?? row.amount
  const providerAmount = Number(providerAmountRaw)
  const expectedAmount = Number(expected.totalAmount)
  if (!Number.isFinite(providerAmount) || providerAmount !== expectedAmount) {
    return {
      ok: false,
      reason: 'amount_mismatch',
      providerAmount: Number.isFinite(providerAmount) ? providerAmount : null,
      expectedAmount,
    }
  }

  const paymentKey = String(row.paymentKey ?? '').trim()
  if (!paymentKey) {
    return { ok: false, reason: 'provider_payment_key_missing' }
  }

  return { ok: true, paymentKey, providerStatus: status }
}
