import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function loadSmsAgentProfile(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(name), ''), username, '') AS agent_name,
      COALESCE(NULLIF(TRIM(phone_number), ''), '') AS agent_phone
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  )
  return {
    agentName: String(r.rows[0]?.agent_name ?? '').trim(),
    agentPhone: String(r.rows[0]?.agent_phone ?? '').trim(),
  }
}

/**
 * @param {string | Date} value
 */
export function formatKstDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
