/**
 * Railway Persistent Worker — sms_send_jobs claim 후 gateway 발송 (기본 모드).
 *
 * Command: node server/sms/runSmsSendWorker.js
 *
 * SMS_SEND_WORKER_MODE:
 *   persistent (default) — 계속 실행
 *   once                 — 1 batch 후 종료 (dev/run-now 보조)
 */
import pool from '../db.js'
import { logSmsModuleEnvironmentHint, validateSmsModuleStartupConfig } from './smsModuleConfig.js'
import {
  recoverStaleProcessingJobs,
  runSmsSendWorkerOnce,
  runSmsSendWorkerPersistent,
} from './smsSendWorkerService.js'

function readWorkerMode() {
  const mode = String(process.env.SMS_SEND_WORKER_MODE ?? 'persistent')
    .trim()
    .toLowerCase()
  return mode === 'once' ? 'once' : 'persistent'
}

async function main() {
  logSmsModuleEnvironmentHint()
  const startup = validateSmsModuleStartupConfig()
  if (!startup.ok) {
    console.warn('[sms-send-worker] startup config warnings', startup.message ?? startup)
  }

  const mode = readWorkerMode()
  if (mode === 'once') {
    const recoveredCount = await recoverStaleProcessingJobs(pool)
    if (recoveredCount > 0) {
      console.info('[sms-send-worker] stale jobs recovered', { recoveredCount })
    }
    console.info('[sms-send-worker] started', { mode: 'once', at: new Date().toISOString() })
    const result = await runSmsSendWorkerOnce(pool)
    console.info('[sms-send-worker] finished', result)
    return
  }

  await runSmsSendWorkerPersistent(pool)
}

main()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('[sms-send-worker] failed', {
      errorCode: String(err?.message ?? 'worker_failed'),
      errorMessage: String(err?.publicMessage ?? err?.message ?? 'sms send worker failed'),
    })
    try {
      await pool.end()
    } catch {
      // ignore pool shutdown errors
    }
    process.exit(1)
  })
