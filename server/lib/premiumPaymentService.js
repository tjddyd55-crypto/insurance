import { safeQuery } from '../utils/dbSafeQuery.js'
import { assertCustomerRowAccessibleByVisibility } from './customerRowVisibilitySql.js'
import { resolveCustomerVisibilitySqlForSelect } from './customerRowVisibilitySql.js'
import { parseGaId } from './parseGaId.js'
import {
  canEncryptPremiumPaymentCards,
  cardNumberLast4,
  decryptPremiumPaymentCardNumber,
  detectCardBrand,
  encryptPremiumPaymentCardNumber,
  getPremiumPaymentCardKeyVersion,
  isValidCardNumberLuhn,
  maskCardNumberDisplay,
  normalizeCardNumberDigits,
} from './premiumPaymentCardCrypto.js'

/**
 * @param {unknown} raw
 * @returns {string}
 */
function trimStr(raw) {
  return String(raw ?? '').trim()
}

/**
 * @param {unknown} raw
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function parseIntInRange(raw, min, max) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) {
    return null
  }
  return n
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ customerName?: string | null }} [extra]
 */
export function mapPremiumPaymentMethodPublicRow(row, extra = {}) {
  const last4 = trimStr(row.card_number_last4)
  return {
    id: Number(row.id),
    gaId: Number(row.ga_id),
    ownerUserId: trimStr(row.owner_user_id),
    customerId: Number(row.customer_id),
    customerName: extra.customerName != null ? trimStr(extra.customerName) : undefined,
    insuranceCompany: trimStr(row.insurance_company),
    policyNumber: trimStr(row.policy_number),
    cardholderName: trimStr(row.cardholder_name),
    maskedCardNumber: maskCardNumberDisplay(last4),
    cardNumberLast4: last4,
    cardBrand: trimStr(row.card_brand) || null,
    cardExpiryMonth: Number(row.card_expiry_month),
    cardExpiryYear: Number(row.card_expiry_year),
    memo: trimStr(row.memo),
    isActive: row.is_active !== false && row.is_active !== 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}

/**
 * @param {import('express').Request} req
 * @returns {{ userId: string; gaId: number } | { error: { status: number; message: string } }}
 */
export function resolvePremiumPaymentActor(req) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    return { error: { status: 401, message: '로그인이 필요합니다.' } }
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    return { error: { status: 400, message: 'GA 컨텍스트가 없습니다.' } }
  }
  return { userId, gaId }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 */
export async function assertPremiumPaymentCustomerAccess(pool, req, customerId) {
  return assertCustomerRowAccessibleByVisibility(pool, safeQuery, req, customerId, {
    requireNonDeleted: true,
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} customerId
 * @returns {Promise<{ ownerUserId: string; customerName: string } | null>}
 */
async function loadCustomerOwner(pool, customerId) {
  const r = await safeQuery(
    pool,
    `
    SELECT user_id, name
    FROM customers
    WHERE id = $1 AND deleted_at IS NULL
    LIMIT 1
    `,
    [customerId],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return {
    ownerUserId: trimStr(row.user_id),
    customerName: trimStr(row.name),
  }
}

/**
 * @param {object} body
 * @param {{ requireCardNumber: boolean }} opts
 */
export function parsePremiumPaymentWriteBody(body, opts) {
  const src = body && typeof body === 'object' ? body : {}
  const insuranceCompany = trimStr(src.insuranceCompany)
  const policyNumber = trimStr(src.policyNumber)
  const cardholderName = trimStr(src.cardholderName)
  const memo = trimStr(src.memo)
  const cardExpiryMonth = parseIntInRange(src.cardExpiryMonth, 1, 12)
  const cardExpiryYear = parseIntInRange(src.cardExpiryYear, 2000, 2100)
  const cardNumberRaw = trimStr(src.cardNumber)
  const cardDigits = normalizeCardNumberDigits(cardNumberRaw)

  if (!insuranceCompany) {
    return { error: '보험회사를 입력해 주세요.' }
  }
  if (!policyNumber) {
    return { error: '증권번호를 입력해 주세요.' }
  }
  if (!cardholderName) {
    return { error: '카드 명의자를 입력해 주세요.' }
  }
  if (cardExpiryMonth == null) {
    return { error: '유효기간(월)을 확인해 주세요.' }
  }
  if (cardExpiryYear == null) {
    return { error: '유효기간(연)을 확인해 주세요.' }
  }

  if (opts.requireCardNumber || cardDigits) {
    if (!cardDigits) {
      return { error: '카드번호를 입력해 주세요.' }
    }
    if (!isValidCardNumberLuhn(cardDigits)) {
      return { error: '유효하지 않은 카드번호입니다.' }
    }
    if (!canEncryptPremiumPaymentCards()) {
      return { error: '카드번호 암호화 설정이 없습니다. 관리자에게 문의해 주세요.' }
    }
  }

  /** @type {{ insuranceCompany: string; policyNumber: string; cardholderName: string; memo: string; cardExpiryMonth: number; cardExpiryYear: number; cardDigits: string | null }} */
  const value = {
    insuranceCompany,
    policyNumber,
    cardholderName,
    memo,
    cardExpiryMonth,
    cardExpiryYear,
    cardDigits: cardDigits || null,
  }
  return { value }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 */
export async function listPremiumPaymentsForCustomer(pool, req, customerId) {
  const ok = await assertPremiumPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_premium_payment_methods
    WHERE customer_id = $1
      AND ga_id = $2
      AND deleted_at IS NULL
    ORDER BY is_active DESC, id DESC
    `,
    [customerId, actor.gaId],
  )
  return { rows: r.rows.map((row) => mapPremiumPaymentMethodPublicRow(row)) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ q?: string; isActive?: boolean | null; limit?: number; offset?: number }} filters
 */
export async function listPremiumPaymentsOverview(pool, req, filters = {}) {
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const vis = resolveCustomerVisibilitySqlForSelect(req, actor.userId, actor.gaId)
  if (vis.blocked) {
    return { rows: [], total: 0 }
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200)
  const offset = Math.max(Number(filters.offset) || 0, 0)
  const q = trimStr(filters.q)
  const params = [...vis.params, actor.gaId]
  let where = `
    ppm.ga_id = $${params.length}
    AND ppm.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (${vis.clause})
  `

  if (filters.isActive === true) {
    where += ` AND ppm.is_active = TRUE`
  } else if (filters.isActive === false) {
    where += ` AND ppm.is_active = FALSE`
  }

  if (q) {
    params.push(`%${q}%`)
    const qPh = `$${params.length}`
    params.push(normalizeCardNumberDigits(q).slice(-4) || '__no_last4__')
    const last4Ph = `$${params.length}`
    where += `
      AND (
        c.name ILIKE ${qPh}
        OR ppm.insurance_company ILIKE ${qPh}
        OR ppm.policy_number ILIKE ${qPh}
        OR ppm.cardholder_name ILIKE ${qPh}
        OR ppm.card_number_last4 = ${last4Ph}
      )
    `
  }

  params.push(limit)
  const limitPh = `$${params.length}`
  params.push(offset)
  const offsetPh = `$${params.length}`

  const countR = await safeQuery(
    pool,
    `
    SELECT COUNT(*)::int AS n
    FROM customer_premium_payment_methods ppm
    INNER JOIN customers c ON c.id = ppm.customer_id
    WHERE ${where}
    `,
    params.slice(0, params.length - 2),
  )
  const listR = await safeQuery(
    pool,
    `
    SELECT ppm.*, c.name AS customer_name
    FROM customer_premium_payment_methods ppm
    INNER JOIN customers c ON c.id = ppm.customer_id
    WHERE ${where}
    ORDER BY ppm.updated_at DESC, ppm.id DESC
    LIMIT ${limitPh} OFFSET ${offsetPh}
    `,
    params,
  )

  return {
    rows: listR.rows.map((row) =>
      mapPremiumPaymentMethodPublicRow(row, { customerName: String(row.customer_name ?? '') }),
    ),
    total: Number(countR.rows[0]?.n ?? 0),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {unknown} body
 */
export async function createPremiumPaymentMethod(pool, req, customerId, body) {
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const ok = await assertPremiumPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const parsed = parsePremiumPaymentWriteBody(body, { requireCardNumber: true })
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const value = parsed.value
  if (!value.cardDigits) {
    return { error: { status: 400, message: '카드번호를 입력해 주세요.' } }
  }

  const owner = await loadCustomerOwner(pool, customerId)
  if (!owner) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }

  let ciphertext
  try {
    ciphertext = encryptPremiumPaymentCardNumber(value.cardDigits)
  } catch {
    return { error: { status: 503, message: '카드번호 암호화 설정이 없습니다. 관리자에게 문의해 주세요.' } }
  }

  const last4 = cardNumberLast4(value.cardDigits)
  const brand = detectCardBrand(value.cardDigits)
  const keyVersion = getPremiumPaymentCardKeyVersion()

  const ins = await safeQuery(
    pool,
    `
    INSERT INTO customer_premium_payment_methods (
      ga_id, owner_user_id, customer_id,
      insurance_company, policy_number, cardholder_name,
      card_number_ciphertext, encryption_key_version,
      card_number_last4, card_brand,
      card_expiry_month, card_expiry_year,
      memo, is_active, created_by, updated_by
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8,
      $9, $10,
      $11, $12,
      $13, TRUE, $14, $14
    )
    RETURNING *
    `,
    [
      actor.gaId,
      owner.ownerUserId || actor.userId,
      customerId,
      value.insuranceCompany,
      value.policyNumber,
      value.cardholderName,
      ciphertext,
      keyVersion,
      last4,
      brand,
      value.cardExpiryMonth,
      value.cardExpiryYear,
      value.memo,
      actor.userId,
    ],
  )
  return { row: mapPremiumPaymentMethodPublicRow(ins.rows[0]) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} paymentId
 * @param {unknown} body
 */
export async function updatePremiumPaymentMethod(pool, req, customerId, paymentId, body) {
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const ok = await assertPremiumPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const parsed = parsePremiumPaymentWriteBody(body, { requireCardNumber: false })
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const value = parsed.value

  const existing = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_premium_payment_methods
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [paymentId, customerId, actor.gaId],
  )
  if (!existing.rows[0]) {
    return { error: { status: 404, message: '결제 정보를 찾을 수 없습니다.' } }
  }

  let ciphertext = existing.rows[0].card_number_ciphertext
  let last4 = existing.rows[0].card_number_last4
  let brand = existing.rows[0].card_brand
  let keyVersion = existing.rows[0].encryption_key_version

  if (value.cardDigits) {
    try {
      ciphertext = encryptPremiumPaymentCardNumber(value.cardDigits)
    } catch {
      return { error: { status: 503, message: '카드번호 암호화 설정이 없습니다. 관리자에게 문의해 주세요.' } }
    }
    last4 = cardNumberLast4(value.cardDigits)
    brand = detectCardBrand(value.cardDigits)
    keyVersion = getPremiumPaymentCardKeyVersion()
  }

  const upd = await safeQuery(
    pool,
    `
    UPDATE customer_premium_payment_methods
    SET
      insurance_company = $1,
      policy_number = $2,
      cardholder_name = $3,
      card_number_ciphertext = $4,
      encryption_key_version = $5,
      card_number_last4 = $6,
      card_brand = $7,
      card_expiry_month = $8,
      card_expiry_year = $9,
      memo = $10,
      updated_by = $11,
      updated_at = NOW()
    WHERE id = $12 AND customer_id = $13 AND ga_id = $14 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      value.insuranceCompany,
      value.policyNumber,
      value.cardholderName,
      ciphertext,
      keyVersion,
      last4,
      brand,
      value.cardExpiryMonth,
      value.cardExpiryYear,
      value.memo,
      actor.userId,
      paymentId,
      customerId,
      actor.gaId,
    ],
  )
  if (!upd.rows[0]) {
    return { error: { status: 404, message: '결제 정보를 찾을 수 없습니다.' } }
  }
  return { row: mapPremiumPaymentMethodPublicRow(upd.rows[0]) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} paymentId
 * @param {boolean} isActive
 */
export async function setPremiumPaymentMethodActive(pool, req, customerId, paymentId, isActive) {
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const ok = await assertPremiumPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const upd = await safeQuery(
    pool,
    `
    UPDATE customer_premium_payment_methods
    SET is_active = $1, updated_by = $2, updated_at = NOW()
    WHERE id = $3 AND customer_id = $4 AND ga_id = $5 AND deleted_at IS NULL
    RETURNING *
    `,
    [isActive, actor.userId, paymentId, customerId, actor.gaId],
  )
  if (!upd.rows[0]) {
    return { error: { status: 404, message: '결제 정보를 찾을 수 없습니다.' } }
  }
  return { row: mapPremiumPaymentMethodPublicRow(upd.rows[0]) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} paymentId
 */
export async function loadPremiumPaymentCiphertextRow(pool, req, customerId, paymentId) {
  const actor = resolvePremiumPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const ok = await assertPremiumPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_premium_payment_methods
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [paymentId, customerId, actor.gaId],
  )
  if (!r.rows[0]) {
    return { error: { status: 404, message: '결제 정보를 찾을 수 없습니다.' } }
  }
  return { row: r.rows[0], actor }
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ digits: string } | { error: string }}
 */
export function decryptPremiumPaymentRowCard(row) {
  try {
    const digits = decryptPremiumPaymentCardNumber(row.card_number_ciphertext)
    return { digits }
  } catch {
    return { error: '카드번호를 복호화할 수 없습니다.' }
  }
}
