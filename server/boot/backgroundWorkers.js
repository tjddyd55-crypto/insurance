import { loadInsuranceAlimtalkConfig } from '../alimtalk/alimtalkConfig.js'
import {
  getClaimReceivedAlimtalkDiagnostics,
  processPendingClaimAlimtalkOutbox,
} from '../alimtalk/claimReceivedAlimtalk.js'
import {
  getCustomerRegistrationCompletedAlimtalkDiagnostics,
  processPendingCustomerRegistrationAlimtalkOutbox,
} from '../alimtalk/customerRegistrationCompletedAlimtalk.js'
import { startInsuranceBillingRenewalWorker } from '../insurance-billing/insuranceBillingRenewalWorker.js'
import { tickAnalyticsAggregationScheduler } from '../lib/analyticsScheduler.js'
import { processPendingPushOutbox } from '../lib/push/pushOutboxService.js'
import { purgeExpiredSmsVerificationCodes } from '../services/purgeExpiredSmsCodes.js'
import { startSmsAutomationScheduler } from '../sms/smsAutomationScheduler.js'

/**
 * Post-listen background ticks (SMS purge, analytics, push/alimtalk outbox, billing renewal).
 * Extracted from server/index.js — wiring only, no route changes.
 *
 * @param {import('pg').Pool} pool
 */
export function startBackgroundWorkers(pool) {
  const SMS_CODE_PURGE_MS = 15 * 60 * 1000
  void purgeExpiredSmsVerificationCodes(pool).catch((err) =>
    console.error('[sms-cleanup] purge failed', err),
  )
  setInterval(() => {
    void purgeExpiredSmsVerificationCodes(pool).catch((err) =>
      console.error('[sms-cleanup] purge failed', err),
    )
  }, SMS_CODE_PURGE_MS)

  const analyticsScheduleState = { lastRunSeoulYmd: null }
  const ANALYTICS_TICK_MS = 60 * 60 * 1000
  void tickAnalyticsAggregationScheduler(pool, analyticsScheduleState)
  setInterval(() => {
    void tickAnalyticsAggregationScheduler(pool, analyticsScheduleState)
  }, ANALYTICS_TICK_MS)

  startSmsAutomationScheduler(pool)
  startInsuranceBillingRenewalWorker(pool)

  const PUSH_OUTBOX_TICK_MS = 15 * 1000
  const pushTickRunning = { current: false }
  const claimAlimtalkTickRunning = { current: false }
  let lastPushTickError = ''
  let lastClaimAlimtalkTickError = ''

  const runPushTick = () => {
    if (pushTickRunning.current) return
    pushTickRunning.current = true
    void processPendingPushOutbox(pool)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg !== lastPushTickError) {
          lastPushTickError = msg
          console.error('[push-outbox] tick failed', msg)
        }
      })
      .finally(() => {
        pushTickRunning.current = false
      })
  }
  runPushTick()
  setInterval(runPushTick, PUSH_OUTBOX_TICK_MS)

  const CLAIM_ALIMTALK_TICK_MS = 15 * 1000
  const claimAlimtalkDiag = getClaimReceivedAlimtalkDiagnostics(loadInsuranceAlimtalkConfig())
  console.info('[claim-alimtalk] diagnostics', {
    ...claimAlimtalkDiag,
    workerRunning: true,
  })
  const registrationAlimtalkDiag = getCustomerRegistrationCompletedAlimtalkDiagnostics(
    loadInsuranceAlimtalkConfig(),
  )
  console.info('[customer-registration-alimtalk] diagnostics', {
    ...registrationAlimtalkDiag,
    workerRunning: true,
  })
  const runClaimAlimtalkTick = () => {
    if (claimAlimtalkTickRunning.current) return
    claimAlimtalkTickRunning.current = true
    void processPendingClaimAlimtalkOutbox(pool)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg !== lastClaimAlimtalkTickError) {
          lastClaimAlimtalkTickError = msg
          console.error('[claim-alimtalk] tick failed', msg)
        }
      })
      .finally(() => {
        claimAlimtalkTickRunning.current = false
      })
  }
  runClaimAlimtalkTick()
  setInterval(runClaimAlimtalkTick, CLAIM_ALIMTALK_TICK_MS)

  const registrationAlimtalkTickRunning = { current: false }
  let lastRegistrationAlimtalkTickError = ''
  const runRegistrationAlimtalkTick = () => {
    if (registrationAlimtalkTickRunning.current) return
    registrationAlimtalkTickRunning.current = true
    void processPendingCustomerRegistrationAlimtalkOutbox(pool)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg !== lastRegistrationAlimtalkTickError) {
          lastRegistrationAlimtalkTickError = msg
          console.error('[customer-registration-alimtalk] tick failed', msg)
        }
      })
      .finally(() => {
        registrationAlimtalkTickRunning.current = false
      })
  }
  runRegistrationAlimtalkTick()
  setInterval(runRegistrationAlimtalkTick, CLAIM_ALIMTALK_TICK_MS)
}
