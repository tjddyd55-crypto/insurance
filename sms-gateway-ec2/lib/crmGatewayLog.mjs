export function maskPhoneTail(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 4) {
    return '****'
  }
  return `***${digits.slice(-4)}`
}

/**
 * @param {{
 *   requestId?: string;
 *   provider?: string;
 *   sender?: string;
 *   receiver?: string;
 *   success: boolean;
 *   errorCode?: string | null;
 *   durationMs?: number;
 * }} entry
 */
export function logCrmGatewayEvent(entry) {
  console.log('[crm-sms-gateway]', {
    request_id: entry.requestId ?? null,
    provider: entry.provider ?? 'aligo',
    sender_tail: maskPhoneTail(entry.sender),
    receiver_tail: maskPhoneTail(entry.receiver),
    success: entry.success,
    error_code: entry.errorCode ?? null,
    duration_ms: entry.durationMs ?? null,
  })
}
