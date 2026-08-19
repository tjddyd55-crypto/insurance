/**
 * 보험 CRM billing renewal dry-run / 1회 실행.
 * production 에서 실행 금지. 일반 USER API 아님.
 *
 * DRY_RUN=1 node server/scripts/runInsuranceBillingRenewalOnce.mjs
 */

import pool from '../db.js'
import { runInsuranceBillingRenewalOnce } from '../insurance-billing/insuranceBillingRenewalWorker.js'

const dryRun = String(process.env.DRY_RUN ?? '1').trim() !== '0'
const testCode = String(process.env.RENEWAL_TEST_CODE ?? '').trim() || null
if (testCode && String(process.env.RAILWAY_ENVIRONMENT_NAME ?? '').toLowerCase() === 'production') {
  throw new Error('RENEWAL_TEST_CODE is forbidden in production')
}

const summary = await runInsuranceBillingRenewalOnce(pool, { dryRun, testCode })
console.log(JSON.stringify(summary, null, 2))
await pool.end()
