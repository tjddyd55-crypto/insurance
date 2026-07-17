/**
 * 발송 로그 스냅샷에서 민감 정보 제거.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeAlimtalkRequestContext(value) {
  if (value == null) return null
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAlimtalkRequestContext(item))
  }
  if (typeof value !== 'object') {
    return value
  }
  const src = /** @type {Record<string, unknown>} */ (value)
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, raw] of Object.entries(src)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('senderkey') ||
      lower.includes('sender_key') ||
      lower === 'password' ||
      lower === 'authorization'
    ) {
      out[key] = '[REDACTED]'
      continue
    }
    if (
      lower.includes('phone') ||
      lower === 'receiver' ||
      lower === 'receiver_1' ||
      lower.includes('mobile')
    ) {
      if (typeof raw === 'string' && /\d{8,}/.test(raw.replace(/\D/g, ''))) {
        const digits = raw.replace(/\D/g, '')
        out[key] = digits.length >= 7 ? `${digits.slice(0, 3)}****${digits.slice(-4)}` : '[REDACTED]'
        continue
      }
    }
    if (lower.includes('url') || lower.includes('link') || lower === 'linkmo' || lower === 'linkpc') {
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const u = new URL(raw)
          out[key] = `${u.origin}${u.pathname}?code=[REDACTED]`
        } catch {
          out[key] = '[REDACTED_URL]'
        }
        continue
      }
    }
    out[key] = sanitizeAlimtalkRequestContext(raw)
  }
  return out
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 */
export async function ensureAlimtalkSendLogsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alimtalk_send_logs (
      id BIGSERIAL PRIMARY KEY,
      ga_id INTEGER,
      user_id TEXT,
      customer_id INTEGER,
      template_key TEXT NOT NULL,
      tpl_code TEXT,
      receiver_masked TEXT,
      status TEXT NOT NULL,
      provider TEXT,
      provider_message_id TEXT,
      provider_code INTEGER,
      provider_message TEXT,
      dry_run BOOLEAN NOT NULL DEFAULT TRUE,
      request_context JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alimtalk_send_logs_customer_created
    ON alimtalk_send_logs (customer_id, created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alimtalk_send_logs_user_created
    ON alimtalk_send_logs (user_id, created_at DESC)
  `)
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {{
 *   gaId?: number | null,
 *   userId?: string | null,
 *   customerId?: number | null,
 *   templateKey: string,
 *   tplCode?: string | null,
 *   receiverMasked?: string | null,
 *   status: string,
 *   provider?: string | null,
 *   providerMessageId?: string | null,
 *   providerCode?: number | null,
 *   providerMessage?: string | null,
 *   dryRun?: boolean,
 *   requestContext?: unknown,
 * }} row
 */
export async function insertAlimtalkSendLog(pool, row) {
  const context = sanitizeAlimtalkRequestContext(row.requestContext ?? null)
  const result = await pool.query(
    `
    INSERT INTO alimtalk_send_logs (
      ga_id, user_id, customer_id, template_key, tpl_code,
      receiver_masked, status, provider, provider_message_id,
      provider_code, provider_message, dry_run, request_context,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13::jsonb,
      NOW(), NOW()
    )
    RETURNING id
    `,
    [
      row.gaId ?? null,
      row.userId ?? null,
      row.customerId ?? null,
      row.templateKey,
      row.tplCode ?? null,
      row.receiverMasked ?? null,
      row.status,
      row.provider ?? null,
      row.providerMessageId ?? null,
      row.providerCode ?? null,
      row.providerMessage != null ? String(row.providerMessage).slice(0, 500) : null,
      row.dryRun !== false,
      context == null ? null : JSON.stringify(context),
    ],
  )
  return Number(result.rows[0]?.id ?? 0) || null
}
