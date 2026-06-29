/**
 * 알리고 remain / gateway balance raw → 단문·장문·그림 건수 파싱·표시 SSOT
 */

/**
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function parseSmsRemainCounts(raw) {
  const body = raw && typeof raw === 'object' ? raw : {}
  return {
    sms: pickRemainCount(body, ['SMS_CNT', 'sms_cnt', 'SMS', 'sms']),
    lms: pickRemainCount(body, ['LMS_CNT', 'lms_cnt', 'LMS', 'lms']),
    mms: pickRemainCount(body, ['MMS_CNT', 'mms_cnt', 'MMS', 'mms']),
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {string[]} keys
 */
function pickRemainCount(body, keys) {
  for (const key of keys) {
    if (body[key] == null || body[key] === '') {
      continue
    }
    const n = Number(body[key])
    if (Number.isFinite(n) && n >= 0) {
      return Math.floor(n)
    }
  }
  return null
}

/**
 * @param {{ sms?: number | null; lms?: number | null; mms?: number | null }} counts
 */
export function formatSmsRemainBalanceText(counts) {
  const sms = counts.sms ?? 0
  const lms = counts.lms ?? 0
  const mms = counts.mms ?? 0
  return `(단문) ${sms}건 (장문) ${lms}건 (그림) ${mms}건`
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function formatSmsRemainBalanceFromRaw(raw) {
  return formatSmsRemainBalanceText(parseSmsRemainCounts(raw))
}
