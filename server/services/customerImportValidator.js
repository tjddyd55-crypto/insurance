/**
 * @typedef {{ byPhone: Map<string, number>, bySsn: Map<string, number> }} DuplicateIndex
 */

const MIN_SSN_LEN_FOR_DUP = 7

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {number} gaId
 */
export async function loadCustomerDuplicateIndex(pool, userId, gaId) {
  const r = await pool.query(
    `
    SELECT id,
      regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') AS pd,
      regexp_replace(COALESCE(ssn, ''), '[^0-9]', '', 'g') AS sd
    FROM customers
    WHERE user_id = $1::text AND ga_id = $2::int AND deleted_at IS NULL
    `,
    [userId, gaId],
  )
  /** @type {Map<string, number>} */
  const byPhone = new Map()
  /** @type {Map<string, number>} */
  const bySsn = new Map()
  for (const row of r.rows) {
    const id = Number(row.id)
    const pd = String(row.pd ?? '')
    if (pd.length >= 8) {
      if (!byPhone.has(pd)) {
        byPhone.set(pd, id)
      }
    }
    const sd = String(row.sd ?? '')
    if (sd.length >= MIN_SSN_LEN_FOR_DUP) {
      if (!bySsn.has(sd)) {
        bySsn.set(sd, id)
      }
    }
  }
  return { byPhone, bySsn }
}

/**
 * @param {object} n normalizeImportRow 결과
 * @param {DuplicateIndex} idx
 */
export function classifyImportRow(n, idx) {
  if (n.genderConflict) {
    return {
      status: 'incomplete',
      reason: '주민번호 기준 성별과 엑셀 성별 컬럼이 충돌합니다.',
      matchedCustomerId: null,
    }
  }
  if (!n.name) {
    if (!n.phone && !n.ssnDigits) {
      return {
        status: 'incomplete',
        reason: '이름·전화·주민번호가 모두 없습니다.',
        matchedCustomerId: null,
      }
    }
    return {
      status: 'incomplete',
      reason: '이름이 없습니다.',
      matchedCustomerId: null,
    }
  }
  if (n.phoneRawDigits && n.phoneInvalidReason) {
    if (!n.ssnDigits) {
      return {
        status: 'incomplete',
        reason: n.phoneInvalidReason,
        matchedCustomerId: null,
      }
    }
  }
  if (!n.phone && !n.ssnDigits) {
    return {
      status: 'incomplete',
      reason: '전화번호와 주민번호가 모두 없습니다.',
      matchedCustomerId: null,
    }
  }
  if (n.phone && idx.byPhone.has(n.phone)) {
    return {
      status: 'duplicate',
      reason: '동일 GA·내 고객 중 전화번호가 일치하는 고객이 있습니다.',
      matchedCustomerId: idx.byPhone.get(n.phone) ?? null,
    }
  }
  if (n.ssnDigits && n.ssnDigits.length >= MIN_SSN_LEN_FOR_DUP && idx.bySsn.has(n.ssnDigits)) {
    return {
      status: 'duplicate',
      reason: '동일 GA·내 고객 중 주민번호가 일치하는 고객이 있습니다.',
      matchedCustomerId: idx.bySsn.get(n.ssnDigits) ?? null,
    }
  }
  return {
    status: 'ready',
    reason: null,
    matchedCustomerId: null,
  }
}
