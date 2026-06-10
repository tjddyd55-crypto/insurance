import pool from './db.js'
import { ensureInsuranceCompanyDirectoryStubs } from './lib/ensureInsuranceCompanyDirectoryStubs.js'
import { systemQuery } from './utils/dbSafeQuery.js'
import { seedAll } from './seedInsuranceFullData.js'

/**
 * insurance_company_master 가 비어 있을 때 seedInsuranceFullData.js 의 SEED_DATA 를 삽입합니다.
 * 이후 canonical stub(처브생명 등)을 멱등 보장합니다.
 */
export async function seedInsuranceCompanyDirectory() {
  const countResult = await systemQuery(pool, `SELECT COUNT(*) AS c FROM insurance_company_master`)
  if ((countResult.rows[0]?.c ?? 0) === 0) {
    await seedAll(pool)
  }

  await ensureInsuranceCompanyDirectoryStubs(pool)
}
