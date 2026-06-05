/**
 * 발급 이력 레포지토리.
 *
 * 책임: `pdf_issuances` 테이블에 대한 CRUD 만 담당. SQL 은 이 파일 바깥으로 나가지 않는다.
 *
 * 스코핑 원칙:
 *   - 사용자 개인 조회는 `userId` 로만 제한.
 *   - GA 내 관리자 조회(후속 PR)는 `gaId` 로만 제한.
 *   - SUPER_ADMIN 전체 조회는 어떤 필터도 없이 허용.
 *   - 고객별 이력 필터는 `customerId` 로만 제한(이름·전화 매칭 금지).
 *   이 3 가지 쿼리가 한 함수로 합쳐지면 실수로 스코프를 비우는 버그가 쉽게 생긴다 →
 *   명시적으로 별도 함수로 분리한다.
 */

const ISSUANCE_SELECT = `
  SELECT i.id, i.template_id, i.user_id, i.ga_id, i.template_code, i.template_title,
         i.storage_key, i.values_snapshot, i.byte_length, i.created_at,
         i.customer_id, i.customer_snapshot, i.vehicle_snapshot,
         c.name AS customer_name
    FROM pdf_issuances i
    LEFT JOIN customers c ON c.id = i.customer_id
`

/**
 * @typedef {{
 *   id: number,
 *   template_id: number | null,
 *   user_id: string | null,
 *   ga_id: number | null,
 *   template_code: string,
 *   template_title: string,
 *   storage_key: string,
 *   values_snapshot: Record<string, string>,
 *   byte_length: number,
 *   created_at: string,
 *   customer_id: number | null,
 *   customer_snapshot: Record<string, unknown> | null,
 *   vehicle_snapshot: Record<string, unknown> | null,
 *   customer_name?: string | null,
 * }} IssuanceRow
 */

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseOptionalCustomerFilter(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * 한 건 저장. 중복 방지 제약은 없다 — 동일 템플릿/값으로 여러 번 발급해도 각기 남는다
 * (사용자가 "같은 문서를 두 번 출력" 한 이력 자체가 유의미).
 *
 * @param {import('pg').Pool} pool
 * @param {{
 *   templateId: number | null,
 *   userId: string | null,
 *   gaId: number | null,
 *   templateCode: string,
 *   templateTitle: string,
 *   storageKey: string,
 *   valuesSnapshot: Record<string, string>,
 *   byteLength: number,
 *   customerId?: number | null,
 *   customerSnapshot?: Record<string, unknown> | null,
 *   vehicleSnapshot?: Record<string, unknown> | null,
 * }} input
 * @returns {Promise<IssuanceRow>}
 */
export async function createIssuance(pool, input) {
  const { rows } = await pool.query(
    `INSERT INTO pdf_issuances
       (template_id, user_id, ga_id, template_code, template_title,
        storage_key, values_snapshot, byte_length,
        customer_id, customer_snapshot, vehicle_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb)
     RETURNING id, template_id, user_id, ga_id, template_code, template_title,
               storage_key, values_snapshot, byte_length, created_at,
               customer_id, customer_snapshot, vehicle_snapshot`,
    [
      input.templateId ?? null,
      input.userId ?? null,
      input.gaId ?? null,
      input.templateCode,
      input.templateTitle,
      input.storageKey,
      JSON.stringify(input.valuesSnapshot ?? {}),
      input.byteLength,
      input.customerId ?? null,
      input.customerSnapshot != null ? JSON.stringify(input.customerSnapshot) : null,
      input.vehicleSnapshot != null ? JSON.stringify(input.vehicleSnapshot) : null,
    ],
  )
  return rows[0]
}

/**
 * 사용자 개인 이력.
 *
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {{ limit?: number, customerId?: number | null }} [options]
 */
export async function listIssuancesByUser(pool, userId, options = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)
  const customerId = parseOptionalCustomerFilter(options.customerId)
  if (customerId != null) {
    const { rows } = await pool.query(
      `${ISSUANCE_SELECT}
        WHERE i.user_id = $1 AND i.customer_id = $2
        ORDER BY i.created_at DESC
        LIMIT $3`,
      [userId, customerId, limit],
    )
    return rows
  }
  const { rows } = await pool.query(
    `${ISSUANCE_SELECT}
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2`,
    [userId, limit],
  )
  return rows
}

/**
 * 관리자(SUPER_ADMIN) 전체 이력. 정렬은 최신순.
 *
 * @param {import('pg').Pool} pool
 * @param {{ limit?: number, customerId?: number | null }} [options]
 */
export async function listIssuancesAll(pool, options = {}) {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1000)
  const customerId = parseOptionalCustomerFilter(options.customerId)
  if (customerId != null) {
    const { rows } = await pool.query(
      `${ISSUANCE_SELECT}
        WHERE i.customer_id = $1
        ORDER BY i.created_at DESC
        LIMIT $2`,
      [customerId, limit],
    )
    return rows
  }
  const { rows } = await pool.query(
    `${ISSUANCE_SELECT}
      ORDER BY i.created_at DESC
      LIMIT $1`,
    [limit],
  )
  return rows
}

/**
 * 단건 조회. 다운로드 라우트에서 소유자 검증과 함께 쓴다.
 *
 * @param {import('pg').Pool} pool
 * @param {number} id
 */
export async function getIssuanceById(pool, id) {
  const { rows } = await pool.query(
    `${ISSUANCE_SELECT}
      WHERE i.id = $1`,
    [id],
  )
  return rows[0] ?? null
}
