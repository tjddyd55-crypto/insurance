/**
 * Railway Cron — due 예약을 outbox(run + send_jobs)로 큐잉 후 종료.
 *
 * Command: node server/sms/runScheduledSmsScheduler.js
 * Cron (UTC): */5 * * * *
 */
import pool from '../db.js'
import { logSmsModuleEnvironmentHint, validateSmsModuleStartupConfig } from './smsModuleConfig.js'
import { queueDueScheduledMessages } from './smsScheduledQueueService.js'

async function main() {
  logSmsModuleEnvironmentHint()
  const startup = validateSmsModuleStartupConfig()
  if (!startup.ok) {
    console.warn('[sms-scheduled] scheduler startup config warnings', startup.message ?? startup)
  }

  console.info('[sms-scheduled] scheduler started', { at: new Date().toISOString() })
  const result = await queueDueScheduledMessages(pool)
  console.info('[sms-scheduled] scheduler finished', result)
}

main()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('[sms-scheduled] scheduler failed', {
      errorCode: String(err?.message ?? 'scheduler_failed'),
      errorMessage: String(err?.publicMessage ?? err?.message ?? 'scheduled scheduler failed'),
    })
    try {
      await pool.end()
    } catch {
      // ignore pool shutdown errors
    }
    process.exit(1)
  })
