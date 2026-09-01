import { getKstDateString } from '../../shared/dateTimeKst.js'
import { isSmsAutomationSchedulerEnabled, isSmsRealSendEnabled } from './smsModuleConfig.js'
import { runAutomationRule } from './smsAutomationExecutionService.js'
import { tryAcquireSchedulerLock } from './smsAutomationRunRepository.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { isQaSafeMode } from '../lib/qaSafeMode.js'

const KST = 'Asia/Seoul'

/**
 * @param {Date} [date]
 * @returns {string} HH:mm (KST)
 */
export function getKstTimeHHmm(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ baseDate?: string; sendTime?: string }} [options]
 */
export async function findDueAutomationRules(executor, options = {}) {
  const baseDate = options.baseDate ?? getKstDateString()
  const sendTime = options.sendTime ?? getKstTimeHHmm()
  const r = await systemQuery(
    executor,
    `
    SELECT id, tenant_id, user_id, ga_id, send_time, rule_name
    FROM sms_automation_rules
    WHERE deleted_at IS NULL
      AND is_active = true
      AND send_time = $1
    ORDER BY id ASC
    `,
    [sendTime],
  )
  return r.rows.map((row) => ({
    ruleId: Number(row.id),
    tenantId: Number(row.tenant_id),
    userId: String(row.user_id),
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
    sendTime: String(row.send_time).slice(0, 5),
    ruleName: String(row.rule_name ?? ''),
    baseDate,
  }))
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ baseDate?: string; sendTime?: string }} [options]
 */
export async function runDueAutomationRulesOnce(executor, options = {}) {
  const baseDate = options.baseDate ?? getKstDateString()
  const sendTime = options.sendTime ?? getKstTimeHHmm()
  const dueRules = await findDueAutomationRules(executor, { baseDate, sendTime })
  const results = []

  for (const rule of dueRules) {
    const lockAcquired = await tryAcquireSchedulerLock(executor, {
      ruleId: rule.ruleId,
      runDate: baseDate,
      sendTime,
    })
    if (!lockAcquired) {
      results.push({
        ruleId: rule.ruleId,
        skipped: true,
        reason: 'scheduler_lock',
      })
      continue
    }

    try {
      const result = await runAutomationRule(
        executor,
        { tenantId: rule.tenantId, userId: rule.userId, gaId: rule.gaId },
        rule.ruleId,
        {
          baseDate,
          realSend: isSmsRealSendEnabled(),
          runType: 'SCHEDULED',
        },
      )
      results.push({ ruleId: rule.ruleId, skipped: false, result })
    } catch (e) {
      results.push({
        ruleId: rule.ruleId,
        skipped: false,
        error: String(e?.publicMessage ?? e?.message ?? 'scheduler_run_failed'),
      })
    }
  }

  return {
    baseDate,
    sendTime,
    checked: dueRules.length,
    results,
  }
}

let schedulerTimer = null

/**
 * @param {import('pg').Pool} pool
 */
export function startSmsAutomationScheduler(pool) {
  if (isQaSafeMode()) {
    console.info('[sms-automation] scheduler disabled (QA_SAFE_MODE=true)')
    return { started: false, reason: 'qa_safe_mode' }
  }
  if (!isSmsAutomationSchedulerEnabled()) {
    console.info('[sms-automation] scheduler disabled (SMS_AUTOMATION_SCHEDULER_ENABLED=false)')
    return { started: false }
  }
  if (schedulerTimer) {
    return { started: true, alreadyRunning: true }
  }

  console.info('[sms-automation] scheduler enabled', {
    realSendEnabled: isSmsRealSendEnabled(),
    at: new Date().toISOString(),
  })

  const tick = () => {
    void runDueAutomationRulesOnce(pool).catch((err) => {
      console.error('[sms-automation] scheduler tick failed', {
        error: String(err?.message ?? err),
      })
    })
  }

  tick()
  schedulerTimer = setInterval(tick, 60_000)
  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref()
  }

  return { started: true }
}

export function stopSmsAutomationScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
