/**
 * 테넌트 경로에서 실수로 ga_id 조건이 빠진 SQL 실행을 막습니다.
 * initDb·로그인·ga_companies 조회 등은 systemQuery를 사용하세요.
 */

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<unknown> }} executor Pool 또는 PoolClient
 * @param {string} text
 * @param {unknown[]|undefined} params
 * @param {{ allowUnscoped?: boolean }} [options]
 */
export async function safeQuery(executor, text, params, options = {}) {
  const { allowUnscoped = false } = options
  if (!allowUnscoped && !/\bga_id\b/i.test(text)) {
    throw new Error(`GA 필터 없는 쿼리 실행 금지: ${String(text).slice(0, 200).trim()}`)
  }
  return executor.query(text, params ?? [])
}

/** 마이그레이션, 로그인, GA 코드 조회 등 ga_id 컬럼이 없는 SQL 전용 */
export async function systemQuery(executor, text, params) {
  return executor.query(text, params ?? [])
}
