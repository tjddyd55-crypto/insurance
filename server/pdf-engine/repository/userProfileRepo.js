/**
 * PDF 자동화 엔진의 고객 자동 매핑을 위한 사용자 프로필 조회.
 *
 * 책임:
 *   - render 요청을 보낸 사용자(req.user.id) 의 "고객 데이터 주입용 속성" 만 가져온다.
 *   - SELECT 컬럼은 customerMapping 이 필요로 하는 최소 집합으로 고정해, 추후 권한/암호화
 *     요구가 들어올 때도 여기 한 군데만 손보면 되게 한다.
 *
 * 반환 규약:
 *   - 존재하지 않는 사용자: null
 *   - 존재하지만 모든 속성이 비어 있어도 row 를 반환(호출측이 "사용자는 있었음" 구분 가능).
 *
 * 비의존: 이 모듈은 customerMapping 도메인 로직을 알지 못한다.
 * 단지 "필요한 컬럼만 조회" 하는 좁은 책임을 진다.
 */

/**
 * @param {import('pg').Pool} pool
 * @param {number} userId
 * @returns {Promise<{
 *   id: number,
 *   display_name: string | null,
 *   phone_number: string | null,
 *   customer_dob: string | Date | null,
 *   customer_address: string | null,
 * } | null>}
 */
export async function getCustomerProfile(pool, userId) {
  if (!Number.isInteger(userId) || userId < 1) return null
  const { rows } = await pool.query(
    `SELECT id, display_name, phone_number, customer_dob, customer_address
       FROM users
      WHERE id = $1`,
    [userId],
  )
  return rows[0] ?? null
}
