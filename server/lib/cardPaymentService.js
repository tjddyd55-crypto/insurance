import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  assertCustomerRowAccessibleByVisibility,
  resolveCustomerVisibilitySqlForSelect,
} from './customerRowVisibilitySql.js'
import { parseGaId } from './parseGaId.js'
import {
  canEncryptPremiumPaymentCards,
  cardNumberLast4,
  decryptPremiumPaymentCardNumber,
  encryptPremiumPaymentCardNumber,
  getPremiumPaymentCardKeyVersion,
  isValidCardNumberLuhn,
  normalizeCardNumberDigits,
} from './premiumPaymentCardCrypto.js'

const CONTRACT_STATUSES = new Set(['PENDING', 'PAUSED'])

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
  if (raw === '' || raw == null) {
    return null
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) {
    return null
  }
  return n
}

/**
 * @param {string} digits
 * @returns {string}
 */
export function formatCardNumberDisplay(digits) {
  const d = normalizeCardNumberDigits(digits)
  if (!d) {
    return ''
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1-')
}

/**
 * @param {number} month
 * @param {number} year
 * @returns {string}
 */
export function formatCardExpiry(month, year) {
  const mm = String(month).padStart(2, '0')
  const yy = String(year).slice(-2)
  return `${mm}/${yy}`
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeTargetMonth(raw) {
  const s = trimStr(raw)
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    return s
  }
  return null
}

/**
 * @returns {string} YYYY-MM in Asia/Seoul-ish local: use UTC+9 approximation via Intl
 */
export function currentTargetMonthKst(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}`
}

/**
 * @param {import('express').Request} req
 */
export function resolveCardPaymentActor(req) {
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
export async function assertCardPaymentCustomerAccess(pool, req, customerId) {
  return assertCustomerRowAccessibleByVisibility(pool, safeQuery, req, customerId, {
    requireNonDeleted: true,
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} customerId
 * @param {number} gaId
 */
async function loadCustomerMeta(pool, customerId, gaId) {
  const r = await safeQuery(
    pool,
    `
    SELECT user_id, name, phone
    FROM customers
    WHERE id = $1 AND ga_id = $2 AND deleted_at IS NULL
    LIMIT 1
    `,
    [customerId, gaId],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return {
    ownerUserId: trimStr(row.user_id),
    customerName: trimStr(row.name),
    customerPhone: trimStr(row.phone),
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ includeCardNumber?: boolean }} [opts]
 */
export function mapPaymentCardPublicRow(row, opts = {}) {
  const last4 = trimStr(row.card_number_last4)
  const month = Number(row.card_expiry_month)
  const year = Number(row.card_expiry_year)
  /** @type {Record<string, unknown>} */
  const out = {
    id: Number(row.id),
    gaId: Number(row.ga_id),
    ownerUserId: trimStr(row.owner_user_id),
    customerId: Number(row.customer_id),
    label: trimStr(row.label),
    cardOwnerName: trimStr(row.card_owner_name),
    cardNumberLast4: last4,
    cardExpiryMonth: month,
    cardExpiryYear: year,
    cardExpiry: formatCardExpiry(month, year),
    isDefault: row.is_default === true || row.is_default === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
  if (opts.includeCardNumber) {
    try {
      const digits = decryptPremiumPaymentCardNumber(row.card_number_ciphertext)
      out.cardNumber = digits
      out.cardNumberDisplay = formatCardNumberDisplay(digits)
    } catch {
      out.cardNumber = null
      out.cardNumberDisplay = last4 ? `••••-••••-••••-${last4}` : null
    }
  }
  return out
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} targetMonth
 * @param {{ card?: Record<string, unknown> | null; customerName?: string; customerPhone?: string; ownerDisplayName?: string }} [extra]
 */
export function mapContractPublicRow(row, targetMonth, extra = {}) {
  const baseStatus = trimStr(row.status) === 'PAUSED' ? 'PAUSED' : 'PENDING'
  const monthCompleted = Boolean(row.month_completed_at || row.completion_id)
  /** @type {'PENDING' | 'COMPLETED' | 'PAUSED'} */
  let monthStatus = 'PENDING'
  if (baseStatus === 'PAUSED') {
    monthStatus = 'PAUSED'
  } else if (monthCompleted) {
    monthStatus = 'COMPLETED'
  }

  const premiumRaw = row.premium_amount
  const premiumAmount =
    premiumRaw == null || premiumRaw === ''
      ? null
      : Number(premiumRaw)

  const card = extra.card ?? null
  return {
    id: Number(row.id),
    gaId: Number(row.ga_id),
    ownerUserId: trimStr(row.owner_user_id),
    customerId: Number(row.customer_id),
    customerName: extra.customerName != null ? trimStr(extra.customerName) : undefined,
    customerPhone: extra.customerPhone != null ? trimStr(extra.customerPhone) : undefined,
    ownerDisplayName: extra.ownerDisplayName != null ? trimStr(extra.ownerDisplayName) : undefined,
    paymentCardId: row.payment_card_id != null ? Number(row.payment_card_id) : null,
    insuranceCompany: trimStr(row.insurance_company),
    policyNumber: row.policy_number == null || trimStr(row.policy_number) === '' ? null : trimStr(row.policy_number),
    productName: row.product_name == null || trimStr(row.product_name) === '' ? null : trimStr(row.product_name),
    premiumAmount: Number.isFinite(premiumAmount) ? premiumAmount : null,
    paymentDay: row.payment_day == null ? null : Number(row.payment_day),
    memo: trimStr(row.memo),
    status: baseStatus,
    monthStatus,
    targetMonth,
    lastCompletedAt:
      row.last_completed_at instanceof Date
        ? row.last_completed_at.toISOString()
        : row.last_completed_at
          ? String(row.last_completed_at)
          : null,
    monthCompletedAt:
      row.month_completed_at instanceof Date
        ? row.month_completed_at.toISOString()
        : row.month_completed_at
          ? String(row.month_completed_at)
          : null,
    card: card
      ? {
          id: Number(card.id),
          label: trimStr(card.label),
          cardOwnerName: trimStr(card.card_owner_name ?? card.cardOwnerName),
          cardNumberLast4: trimStr(card.card_number_last4 ?? card.cardNumberLast4),
          cardNumber: card.cardNumber ?? null,
          cardNumberDisplay: card.cardNumberDisplay ?? null,
          cardExpiry: card.cardExpiry ?? formatCardExpiry(Number(card.card_expiry_month), Number(card.card_expiry_year)),
          cardExpiryMonth: Number(card.card_expiry_month ?? card.cardExpiryMonth),
          cardExpiryYear: Number(card.card_expiry_year ?? card.cardExpiryYear),
        }
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}

/**
 * @param {object} body
 * @param {{ requireCardNumber: boolean }} opts
 */
export function parsePaymentCardWriteBody(body, opts) {
  const src = body && typeof body === 'object' ? body : {}
  const label = trimStr(src.label)
  const cardOwnerName = trimStr(src.cardOwnerName)
  const cardExpiryMonth = parseIntInRange(src.cardExpiryMonth, 1, 12)
  const cardExpiryYear = parseIntInRange(src.cardExpiryYear, 2000, 2100)
  const cardDigits = normalizeCardNumberDigits(src.cardNumber)

  if (!cardOwnerName) {
    return { error: '카드 소유주를 입력해 주세요.' }
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

  return {
    value: {
      label,
      cardOwnerName,
      cardExpiryMonth,
      cardExpiryYear,
      cardDigits: cardDigits || null,
    },
  }
}

/**
 * @param {object} body
 */
export function parseContractWriteBody(body) {
  const src = body && typeof body === 'object' ? body : {}
  const insuranceCompany = trimStr(src.insuranceCompany)
  if (!insuranceCompany) {
    return { error: '보험회사를 입력해 주세요.' }
  }

  const policyNumberRaw = trimStr(src.policyNumber)
  const productNameRaw = trimStr(src.productName)
  const memo = trimStr(src.memo)
  const paymentDay = parseIntInRange(src.paymentDay, 1, 31)

  let premiumAmount = null
  if (src.premiumAmount !== '' && src.premiumAmount != null) {
    const n = Number(String(src.premiumAmount).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { error: '보험료는 0 이상의 정수로 입력해 주세요.' }
    }
    premiumAmount = n
  }

  let paymentCardId = null
  if (src.paymentCardId !== '' && src.paymentCardId != null) {
    const id = Number(src.paymentCardId)
    if (!Number.isInteger(id) || id < 1) {
      return { error: '사용할 카드 선택이 올바르지 않습니다.' }
    }
    paymentCardId = id
  }

  let status = 'PENDING'
  if (src.status != null && trimStr(src.status) !== '') {
    const s = trimStr(src.status).toUpperCase()
    if (!CONTRACT_STATUSES.has(s)) {
      return { error: '상태 값이 올바르지 않습니다.' }
    }
    status = s
  }

  return {
    value: {
      insuranceCompany,
      policyNumber: policyNumberRaw || null,
      productName: productNameRaw || null,
      premiumAmount,
      paymentDay,
      paymentCardId,
      memo,
      status,
    },
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 */
export async function listPaymentCardsForCustomer(pool, req, customerId) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_payment_cards
    WHERE customer_id = $1
      AND ga_id = $2
      AND deleted_at IS NULL
    ORDER BY is_default DESC, id DESC
    `,
    [customerId, actor.gaId],
  )
  return {
    cards: r.rows.map((row) => mapPaymentCardPublicRow(row, { includeCardNumber: true })),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {object} body
 */
export async function createPaymentCard(pool, req, customerId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const meta = await loadCustomerMeta(pool, customerId, actor.gaId)
  if (!meta) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const parsed = parsePaymentCardWriteBody(body, { requireCardNumber: true })
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const { value } = parsed
  const ciphertext = encryptPremiumPaymentCardNumber(value.cardDigits)
  const last4 = cardNumberLast4(value.cardDigits)
  const keyVersion = getPremiumPaymentCardKeyVersion()
  const r = await safeQuery(
    pool,
    `
    INSERT INTO customer_payment_cards (
      ga_id, owner_user_id, customer_id, label, card_owner_name,
      card_number_ciphertext, encryption_key_version, card_number_last4,
      card_expiry_month, card_expiry_year, created_by, updated_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $11
    )
    RETURNING *
    `,
    [
      actor.gaId,
      meta.ownerUserId,
      customerId,
      value.label,
      value.cardOwnerName,
      ciphertext,
      keyVersion,
      last4,
      value.cardExpiryMonth,
      value.cardExpiryYear,
      actor.userId,
    ],
  )
  return { card: mapPaymentCardPublicRow(r.rows[0], { includeCardNumber: true }) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} cardId
 * @param {object} body
 */
export async function updatePaymentCard(pool, req, customerId, cardId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const parsed = parsePaymentCardWriteBody(body, { requireCardNumber: false })
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const { value } = parsed
  const existing = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_payment_cards
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [cardId, customerId, actor.gaId],
  )
  if (!existing.rows[0]) {
    return { error: { status: 404, message: '카드정보를 찾을 수 없습니다.' } }
  }

  let ciphertext = existing.rows[0].card_number_ciphertext
  let last4 = existing.rows[0].card_number_last4
  let keyVersion = existing.rows[0].encryption_key_version
  if (value.cardDigits) {
    ciphertext = encryptPremiumPaymentCardNumber(value.cardDigits)
    last4 = cardNumberLast4(value.cardDigits)
    keyVersion = getPremiumPaymentCardKeyVersion()
  }

  const r = await safeQuery(
    pool,
    `
    UPDATE customer_payment_cards
    SET label = $1,
        card_owner_name = $2,
        card_number_ciphertext = $3,
        encryption_key_version = $4,
        card_number_last4 = $5,
        card_expiry_month = $6,
        card_expiry_year = $7,
        updated_by = $8,
        updated_at = NOW()
    WHERE id = $9 AND customer_id = $10 AND ga_id = $11 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      value.label,
      value.cardOwnerName,
      ciphertext,
      keyVersion,
      last4,
      value.cardExpiryMonth,
      value.cardExpiryYear,
      actor.userId,
      cardId,
      customerId,
      actor.gaId,
    ],
  )
  if (!r.rows[0]) {
    return { error: { status: 404, message: '카드정보를 찾을 수 없습니다.' } }
  }
  return { card: mapPaymentCardPublicRow(r.rows[0], { includeCardNumber: true }) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} cardId
 */
export async function deletePaymentCard(pool, req, customerId, cardId) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const r = await safeQuery(
    pool,
    `
    UPDATE customer_payment_cards
    SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
    WHERE id = $2 AND customer_id = $3 AND ga_id = $4 AND deleted_at IS NULL
    RETURNING id
    `,
    [actor.userId, cardId, customerId, actor.gaId],
  )
  if (!r.rows[0]) {
    return { error: { status: 404, message: '카드정보를 찾을 수 없습니다.' } }
  }
  await safeQuery(
    pool,
    `
    UPDATE customer_card_payment_contracts
    SET payment_card_id = NULL, updated_at = NOW()
    WHERE payment_card_id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    `,
    [cardId, customerId, actor.gaId],
  )
  return { ok: true }
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 * @param {number} customerId
 * @param {number | null} paymentCardId
 */
async function assertCardBelongsToCustomer(pool, gaId, customerId, paymentCardId) {
  if (paymentCardId == null) {
    return true
  }
  const r = await safeQuery(
    pool,
    `
    SELECT id
    FROM customer_payment_cards
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [paymentCardId, customerId, gaId],
  )
  return Boolean(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {string} [targetMonth]
 */
export async function listContractsForCustomer(pool, req, customerId, targetMonth) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const month = normalizeTargetMonth(targetMonth) || currentTargetMonthKst()
  const meta = await loadCustomerMeta(pool, customerId, actor.gaId)
  const r = await safeQuery(
    pool,
    `
    SELECT c.*,
           comp.id AS completion_id,
           comp.completed_at AS month_completed_at,
           card.id AS card_row_id,
           card.label AS card_label,
           card.card_owner_name AS card_owner_name,
           card.card_number_last4 AS card_last4,
           card.card_number_ciphertext AS card_ciphertext,
           card.card_expiry_month AS card_expiry_month,
           card.card_expiry_year AS card_expiry_year
    FROM customer_card_payment_contracts c
    LEFT JOIN customer_card_payment_completions comp
      ON comp.contract_id = c.id AND comp.target_month = $3
    LEFT JOIN customer_payment_cards card
      ON card.id = c.payment_card_id AND card.deleted_at IS NULL
    WHERE c.customer_id = $1
      AND c.ga_id = $2
      AND c.deleted_at IS NULL
    ORDER BY
      CASE WHEN c.status = 'PAUSED' THEN 2
           WHEN comp.id IS NULL THEN 0
           ELSE 1 END,
      CASE WHEN c.payment_day IS NULL THEN 1 ELSE 0 END,
      c.payment_day ASC NULLS LAST,
      c.insurance_company ASC,
      c.id ASC
    `,
    [customerId, actor.gaId, month],
  )

  const contracts = r.rows.map((row) => {
    let card = null
    if (row.card_row_id) {
      const cardMapped = mapPaymentCardPublicRow(
        {
          id: row.card_row_id,
          ga_id: actor.gaId,
          owner_user_id: actor.userId,
          customer_id: customerId,
          label: row.card_label,
          card_owner_name: row.card_owner_name,
          card_number_ciphertext: row.card_ciphertext,
          card_number_last4: row.card_last4,
          card_expiry_month: row.card_expiry_month,
          card_expiry_year: row.card_expiry_year,
          is_default: false,
          created_at: null,
          updated_at: null,
        },
        { includeCardNumber: true },
      )
      card = {
        id: cardMapped.id,
        label: cardMapped.label,
        cardOwnerName: cardMapped.cardOwnerName,
        cardNumberLast4: cardMapped.cardNumberLast4,
        cardNumber: cardMapped.cardNumber,
        cardNumberDisplay: cardMapped.cardNumberDisplay,
        cardExpiry: cardMapped.cardExpiry,
        cardExpiryMonth: cardMapped.cardExpiryMonth,
        cardExpiryYear: cardMapped.cardExpiryYear,
      }
    }
    return mapContractPublicRow(row, month, {
      card,
      customerName: meta?.customerName,
      customerPhone: meta?.customerPhone,
    })
  })

  return { targetMonth: month, contracts }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {object} body
 */
export async function createContract(pool, req, customerId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const meta = await loadCustomerMeta(pool, customerId, actor.gaId)
  if (!meta) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const parsed = parseContractWriteBody(body)
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const { value } = parsed
  const cardOk = await assertCardBelongsToCustomer(pool, actor.gaId, customerId, value.paymentCardId)
  if (!cardOk) {
    return { error: { status: 400, message: '다른 고객의 카드는 연결할 수 없습니다.' } }
  }
  const r = await safeQuery(
    pool,
    `
    INSERT INTO customer_card_payment_contracts (
      ga_id, owner_user_id, customer_id, payment_card_id,
      insurance_company, policy_number, product_name, premium_amount,
      payment_day, memo, status, created_by, updated_by
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12, $12
    )
    RETURNING *
    `,
    [
      actor.gaId,
      meta.ownerUserId,
      customerId,
      value.paymentCardId,
      value.insuranceCompany,
      value.policyNumber,
      value.productName,
      value.premiumAmount,
      value.paymentDay,
      value.memo,
      value.status,
      actor.userId,
    ],
  )
  const month = currentTargetMonthKst()
  return {
    contract: mapContractPublicRow(r.rows[0], month, {
      customerName: meta.customerName,
      customerPhone: meta.customerPhone,
    }),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} contractId
 * @param {object} body
 */
export async function updateContract(pool, req, customerId, contractId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const parsed = parseContractWriteBody(body)
  if ('error' in parsed) {
    return { error: { status: 400, message: parsed.error } }
  }
  const { value } = parsed
  const cardOk = await assertCardBelongsToCustomer(pool, actor.gaId, customerId, value.paymentCardId)
  if (!cardOk) {
    return { error: { status: 400, message: '다른 고객의 카드는 연결할 수 없습니다.' } }
  }
  const r = await safeQuery(
    pool,
    `
    UPDATE customer_card_payment_contracts
    SET payment_card_id = $1,
        insurance_company = $2,
        policy_number = $3,
        product_name = $4,
        premium_amount = $5,
        payment_day = $6,
        memo = $7,
        status = $8,
        updated_by = $9,
        updated_at = NOW()
    WHERE id = $10 AND customer_id = $11 AND ga_id = $12 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      value.paymentCardId,
      value.insuranceCompany,
      value.policyNumber,
      value.productName,
      value.premiumAmount,
      value.paymentDay,
      value.memo,
      value.status,
      actor.userId,
      contractId,
      customerId,
      actor.gaId,
    ],
  )
  if (!r.rows[0]) {
    return { error: { status: 404, message: '수납 대상을 찾을 수 없습니다.' } }
  }
  const month = currentTargetMonthKst()
  return { contract: mapContractPublicRow(r.rows[0], month) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} contractId
 */
export async function deleteContract(pool, req, customerId, contractId) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const r = await safeQuery(
    pool,
    `
    UPDATE customer_card_payment_contracts
    SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
    WHERE id = $2 AND customer_id = $3 AND ga_id = $4 AND deleted_at IS NULL
    RETURNING id
    `,
    [actor.userId, contractId, customerId, actor.gaId],
  )
  if (!r.rows[0]) {
    return { error: { status: 404, message: '수납 대상을 찾을 수 없습니다.' } }
  }
  return { ok: true }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} contractId
 * @param {object} body
 */
export async function completeContractMonth(pool, req, customerId, contractId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const src = body && typeof body === 'object' ? body : {}
  const month = normalizeTargetMonth(src.targetMonth) || currentTargetMonthKst()
  const memo = trimStr(src.memo)

  const contract = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_card_payment_contracts
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [contractId, customerId, actor.gaId],
  )
  if (!contract.rows[0]) {
    return { error: { status: 404, message: '수납 대상을 찾을 수 없습니다.' } }
  }
  if (trimStr(contract.rows[0].status) === 'PAUSED') {
    return { error: { status: 400, message: '보류 상태에서는 완료 처리할 수 없습니다. 먼저 처리 필요로 변경해 주세요.' } }
  }

  const r = await safeQuery(
    pool,
    `
    INSERT INTO customer_card_payment_completions (
      ga_id, contract_id, customer_id, target_month, completed_at, completed_by, memo
    ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)
    ON CONFLICT (contract_id, target_month)
    DO UPDATE SET
      completed_at = EXCLUDED.completed_at,
      completed_by = EXCLUDED.completed_by,
      memo = EXCLUDED.memo
    RETURNING *
    `,
    [actor.gaId, contractId, customerId, month, actor.userId, memo],
  )

  await safeQuery(
    pool,
    `
    UPDATE customer_card_payment_contracts
    SET last_completed_at = $1, updated_by = $2, updated_at = NOW()
    WHERE id = $3
    `,
    [r.rows[0].completed_at, actor.userId, contractId],
  )

  const refreshed = await listContractsForCustomer(pool, req, customerId, month)
  if ('error' in refreshed) {
    return refreshed
  }
  const found = refreshed.contracts.find((c) => c.id === contractId)
  return { completion: r.rows[0], contract: found, targetMonth: month }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 * @param {number} contractId
 * @param {object} body
 */
export async function reopenContractMonth(pool, req, customerId, contractId, body) {
  const ok = await assertCardPaymentCustomerAccess(pool, req, customerId)
  if (!ok) {
    return { error: { status: 404, message: '고객을 찾을 수 없습니다.' } }
  }
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const src = body && typeof body === 'object' ? body : {}
  const month = normalizeTargetMonth(src.targetMonth) || currentTargetMonthKst()

  const contract = await safeQuery(
    pool,
    `
    SELECT id
    FROM customer_card_payment_contracts
    WHERE id = $1 AND customer_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [contractId, customerId, actor.gaId],
  )
  if (!contract.rows[0]) {
    return { error: { status: 404, message: '수납 대상을 찾을 수 없습니다.' } }
  }

  await safeQuery(
    pool,
    `
    DELETE FROM customer_card_payment_completions
    WHERE contract_id = $1 AND target_month = $2 AND ga_id = $3
    `,
    [contractId, month, actor.gaId],
  )

  if (src.setPending === true || src.setPending === 'true') {
    await safeQuery(
      pool,
      `
      UPDATE customer_card_payment_contracts
      SET status = 'PENDING', updated_by = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [actor.userId, contractId],
    )
  }

  const refreshed = await listContractsForCustomer(pool, req, customerId, month)
  if ('error' in refreshed) {
    return refreshed
  }
  const found = refreshed.contracts.find((c) => c.id === contractId)
  return { contract: found, targetMonth: month }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{
 *   month?: string
 *   status?: string
 *   search?: string
 *   insuranceCompany?: string
 *   paymentDay?: string
 *   ownerUserId?: string
 *   limit?: number
 *   offset?: number
 * }} query
 */
export async function listCardPaymentContractsOverview(pool, req, query) {
  const actor = resolveCardPaymentActor(req)
  if ('error' in actor) {
    return { error: actor.error }
  }
  const vis = resolveCustomerVisibilitySqlForSelect(req, actor.userId, actor.gaId)
  if (vis.blocked) {
    return {
      targetMonth: normalizeTargetMonth(query.month) || currentTargetMonthKst(),
      summary: { total: 0, pending: 0, completed: 0, paused: 0 },
      contracts: [],
    }
  }

  const month = normalizeTargetMonth(query.month) || currentTargetMonthKst()
  const statusFilter = trimStr(query.status).toUpperCase()
  const search = trimStr(query.search).toLowerCase()
  const insuranceCompany = trimStr(query.insuranceCompany)
  const paymentDayFilter = trimStr(query.paymentDay)
  const ownerUserId = trimStr(query.ownerUserId)
  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 1000)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const params = [...vis.params]
  params.push(actor.gaId)
  const gaPh = `$${params.length}`
  params.push(month)
  const monthPh = `$${params.length}`

  let extraWhere = ''
  if (insuranceCompany) {
    params.push(`%${insuranceCompany}%`)
    extraWhere += ` AND ctr.insurance_company ILIKE $${params.length}`
  }
  if (ownerUserId) {
    params.push(ownerUserId)
    extraWhere += ` AND ctr.owner_user_id = $${params.length}`
  }
  if (paymentDayFilter === 'missing') {
    extraWhere += ' AND ctr.payment_day IS NULL'
  } else if (paymentDayFilter === '1-10') {
    extraWhere += ' AND ctr.payment_day BETWEEN 1 AND 10'
  } else if (paymentDayFilter === '11-20') {
    extraWhere += ' AND ctr.payment_day BETWEEN 11 AND 20'
  } else if (paymentDayFilter === '21-31') {
    extraWhere += ' AND ctr.payment_day BETWEEN 21 AND 31'
  } else if (paymentDayFilter === 'today') {
    const day = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', day: 'numeric' }).format(new Date()),
    )
    params.push(day)
    extraWhere += ` AND ctr.payment_day = $${params.length}`
  } else {
    const dayNum = parseIntInRange(paymentDayFilter, 1, 31)
    if (dayNum != null) {
      params.push(dayNum)
      extraWhere += ` AND ctr.payment_day = $${params.length}`
    }
  }

  params.push(limit)
  const limitPh = `$${params.length}`
  params.push(offset)
  const offsetPh = `$${params.length}`

  const r = await safeQuery(
    pool,
    `
    SELECT ctr.*,
           comp.id AS completion_id,
           comp.completed_at AS month_completed_at,
           c.name AS customer_name,
           c.phone AS customer_phone,
           u.name AS owner_display_name,
           card.id AS card_row_id,
           card.label AS card_label,
           card.card_owner_name AS card_owner_name,
           card.card_number_last4 AS card_last4,
           card.card_number_ciphertext AS card_ciphertext,
           card.card_expiry_month AS card_expiry_month,
           card.card_expiry_year AS card_expiry_year
    FROM customer_card_payment_contracts ctr
    INNER JOIN customers c ON c.id = ctr.customer_id AND c.deleted_at IS NULL
    LEFT JOIN users u ON u.id = ctr.owner_user_id
    LEFT JOIN customer_card_payment_completions comp
      ON comp.contract_id = ctr.id AND comp.target_month = ${monthPh}
    LEFT JOIN customer_payment_cards card
      ON card.id = ctr.payment_card_id AND card.deleted_at IS NULL
    WHERE ctr.ga_id = ${gaPh}
      AND ctr.deleted_at IS NULL
      AND (${vis.clause})
      ${extraWhere}
    ORDER BY
      CASE WHEN ctr.status = 'PAUSED' THEN 2
           WHEN comp.id IS NULL THEN 0
           ELSE 1 END,
      CASE WHEN ctr.payment_day IS NULL THEN 1 ELSE 0 END,
      ctr.payment_day ASC NULLS LAST,
      c.name ASC,
      ctr.insurance_company ASC,
      ctr.id ASC
    LIMIT ${limitPh} OFFSET ${offsetPh}
    `,
    params,
  )

  let contracts = r.rows.map((row) => {
    let card = null
    if (row.card_row_id) {
      const mapped = mapPaymentCardPublicRow(
        {
          id: row.card_row_id,
          ga_id: row.ga_id,
          owner_user_id: row.owner_user_id,
          customer_id: row.customer_id,
          label: row.card_label,
          card_owner_name: row.card_owner_name,
          card_number_ciphertext: row.card_ciphertext,
          card_number_last4: row.card_last4,
          card_expiry_month: row.card_expiry_month,
          card_expiry_year: row.card_expiry_year,
          is_default: false,
          created_at: null,
          updated_at: null,
        },
        { includeCardNumber: true },
      )
      card = {
        id: mapped.id,
        label: mapped.label,
        cardOwnerName: mapped.cardOwnerName,
        cardNumberLast4: mapped.cardNumberLast4,
        cardNumber: mapped.cardNumber,
        cardNumberDisplay: mapped.cardNumberDisplay,
        cardExpiry: mapped.cardExpiry,
        cardExpiryMonth: mapped.cardExpiryMonth,
        cardExpiryYear: mapped.cardExpiryYear,
      }
    }
    return mapContractPublicRow(row, month, {
      card,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      ownerDisplayName: row.owner_display_name,
    })
  })

  if (search) {
    contracts = contracts.filter((item) => {
      const hay = [
        item.customerName,
        item.customerPhone,
        item.insuranceCompany,
        item.policyNumber,
        item.productName,
        item.card?.cardOwnerName,
        item.card?.cardNumberLast4,
        item.card?.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(search)
    })
  }

  if (statusFilter === 'PENDING' || statusFilter === 'COMPLETED' || statusFilter === 'PAUSED') {
    contracts = contracts.filter((item) => item.monthStatus === statusFilter)
  }

  const summary = {
    total: contracts.length,
    pending: contracts.filter((item) => item.monthStatus === 'PENDING').length,
    completed: contracts.filter((item) => item.monthStatus === 'COMPLETED').length,
    paused: contracts.filter((item) => item.monthStatus === 'PAUSED').length,
  }

  return { targetMonth: month, summary, contracts }
}
