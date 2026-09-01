/**
 * Toss billingKey 자동갱신 worker.
 * import 만으로 시작하지 않는다. startInsuranceBillingRenewalWorker(pool) 필요.
 */

import { getInsuranceBillingProvider } from './config.js'
import {
  getInsuranceBillingRenewalBatchSize,
  getInsuranceBillingRenewalIntervalMs,
  isInsuranceBillingRenewalWorkerEnabled,
} from './renewalPolicy.js'
import {
  listDueInsuranceRenewalsDryRun,
  renewInsuranceSubscription,
} from './renewInsuranceSubscription.js'
import { isQaSafeMode } from '../lib/qaSafeMode.js'

const diagnostics = {
  enabled: false,
  running: false,
  intervalMs: getInsuranceBillingRenewalIntervalMs(),
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastSummary: null,
}

let tickRunning = false
let timer = null

export function getInsuranceBillingRenewalWorkerDiagnostics() {
  return {
    enabled: isInsuranceBillingRenewalWorkerEnabled(),
    running: Boolean(timer),
    tickRunning,
    intervalMs: getInsuranceBillingRenewalIntervalMs(),
    lastRunAt: diagnostics.lastRunAt,
    lastSuccessAt: diagnostics.lastSuccessAt,
    lastErrorAt: diagnostics.lastErrorAt,
    lastSummary: diagnostics.lastSummary,
  }
}

function emptySummary() {
  return { dueCount: 0, attempted: 0, paid: 0, failed: 0, skipped: 0, durationMs: 0 }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ dryRun?: boolean; now?: Date; testCode?: string | null; limit?: number }} [options]
 */
export async function runInsuranceBillingRenewalOnce(pool, options = {}) {
  const started = Date.now()
  const summary = emptySummary()
  const now = options.now ?? new Date()
  const limit = options.limit ?? getInsuranceBillingRenewalBatchSize()

  if (getInsuranceBillingProvider() !== 'toss') {
    summary.skipped = 1
    diagnostics.lastRunAt = new Date().toISOString()
    diagnostics.lastSummary = { ...summary, reason: 'provider_not_toss', durationMs: Date.now() - started }
    return diagnostics.lastSummary
  }

  const due = await listDueInsuranceRenewalsDryRun(pool, { now, limit })
  summary.dueCount = due.length

  if (options.dryRun) {
    summary.skipped = due.length
    summary.durationMs = Date.now() - started
    diagnostics.lastRunAt = new Date().toISOString()
    diagnostics.lastSummary = {
      ...summary,
      dryRun: true,
      due: due.map((row) => ({
        subscriptionId: row.id,
        nextBillingAt: row.nextBillingAt,
        billingCycle: row.billingCycle,
      })),
    }
    return diagnostics.lastSummary
  }

  for (const row of due) {
    summary.attempted += 1
    const itemClient = await pool.connect()
    try {
      await itemClient.query('BEGIN')
      const result = await renewInsuranceSubscription(itemClient, {
        subscriptionId: row.id,
        now,
        testCode: options.testCode ?? null,
      })
      await itemClient.query('COMMIT')
      if (result.outcome === 'paid') summary.paid += 1
      else if (result.outcome === 'failed') summary.failed += 1
      else summary.skipped += 1
      console.info('[billing-renewal] item', {
        subscriptionId: row.id,
        paymentId: result.paymentId ?? null,
        outcome: result.outcome,
        reason: result.reason,
      })
    } catch (error) {
      try {
        await itemClient.query('ROLLBACK')
      } catch {
        // ignore
      }
      summary.failed += 1
      console.error('[billing-renewal] item-error', {
        subscriptionId: row.id,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      itemClient.release()
    }
  }

  summary.durationMs = Date.now() - started
  diagnostics.lastRunAt = new Date().toISOString()
  diagnostics.lastSuccessAt = diagnostics.lastRunAt
  diagnostics.lastSummary = summary
  console.info('[billing-renewal] tick', summary)
  return summary
}

async function runTick(pool) {
  if (tickRunning) {
    return
  }
  if (!isInsuranceBillingRenewalWorkerEnabled()) {
    return
  }
  tickRunning = true
  try {
    await runInsuranceBillingRenewalOnce(pool)
  } catch (error) {
    diagnostics.lastErrorAt = new Date().toISOString()
    console.error('[billing-renewal] tick failed', error instanceof Error ? error.message : String(error))
  } finally {
    tickRunning = false
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export function startInsuranceBillingRenewalWorker(pool) {
  if (isQaSafeMode()) {
    diagnostics.enabled = false
    diagnostics.running = false
    console.info('[billing-renewal] disabled (QA_SAFE_MODE=true)')
    return
  }
  const enabled = isInsuranceBillingRenewalWorkerEnabled()
  const intervalMs = getInsuranceBillingRenewalIntervalMs()
  diagnostics.enabled = enabled
  diagnostics.intervalMs = intervalMs
  console.info('[billing-renewal] diagnostics', {
    enabled,
    running: false,
    intervalMs,
    provider: getInsuranceBillingProvider(),
  })
  if (!enabled) {
    return
  }
  if (timer) {
    return
  }
  void runTick(pool)
  timer = setInterval(() => {
    void runTick(pool)
  }, intervalMs)
}

export function stopInsuranceBillingRenewalWorker() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
