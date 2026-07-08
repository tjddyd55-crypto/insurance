import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimSmsSendJobs,
  createSendRateLimiter,
  recoverStaleProcessingJobs,
  resolveSmsSendWorkerRuntimeConfig,
  runSmsSendWorkerOnce,
  runSmsSendWorkerPersistent,
} from './smsSendWorkerService.js'

process.env.SMS_MODULE_ENABLED = 'true'
process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'

function createWorkerMockPool(state) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)

      if (text.includes('WITH picked AS') && text.includes('FROM sms_send_jobs')) {
        const limit = Number(params[0])
        const picked = state.jobs
          .filter((job) => (job.status === 'queued' || job.status === 'retry') && !job.locked)
          .slice(0, limit)
        for (const job of picked) {
          job.status = 'processing'
          job.locked = true
          job.locked_by = params[1]
        }
        return { rowCount: picked.length, rows: picked.map((job) => ({ ...job })) }
      }

      if (text.includes('Stale processing lock recovered after worker interruption')) {
        const staleMinutes = Number(params[0])
        const cutoff = Date.now() - staleMinutes * 60_000
        let recovered = 0
        for (const job of state.jobs) {
          if (job.status !== 'processing' || !job.locked_at) {
            continue
          }
          if (new Date(job.locked_at).getTime() >= cutoff) {
            continue
          }
          if (Number(job.attempt_count ?? 0) >= Number(job.max_attempts ?? 3)) {
            job.status = 'failed'
            job.error_code = 'stale_lock_failed'
          } else {
            job.status = 'retry'
            job.error_code = 'stale_lock_recovered'
            job.scheduled_for = new Date().toISOString()
          }
          job.locked_at = null
          job.locked_by = null
          recovered += 1
        }
        return { rowCount: recovered, rows: Array.from({ length: recovered }, (_, index) => ({ id: `recovered-${index}` })) }
      }

      if (text.includes('UPDATE sms_send_jobs') && text.includes('attempt_count = $3')) {
        const job = state.jobs.find((item) => item.id === params[0])
        if (job) {
          job.status = params[1]
          job.attempt_count = params[2]
          job.scheduled_for = params[3]
          job.error_code = params[5]
          job.error_message = params[6]
          job.sent_at = params[7]
          job.locked_at = null
          job.locked_by = null
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('FROM sms_scheduled_runs') && text.includes('scheduled_run_at')) {
        const run = state.runs.find((item) => item.id === params[0])
        return { rowCount: run ? 1 : 0, rows: run ? [run] : [] }
      }

      if (text.includes('INSERT INTO sms_scheduled_message_deliveries')) {
        state.deliveries.push({ phone: params[2], status: params[4] })
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_recipients')) {
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('FROM sms_send_jobs') && text.includes('run_id = $1') && text.includes('pending_count')) {
        const jobs = state.jobs.filter((job) => job.run_id === params[0])
        const sent = jobs.filter((job) => job.status === 'sent').length
        const failed = jobs.filter((job) => job.status === 'failed').length
        const skipped = jobs.filter((job) => job.status === 'skipped').length
        const pending = jobs.filter((job) => ['queued', 'retry', 'processing'].includes(job.status)).length
        return {
          rowCount: 1,
          rows: [{ sent_count: sent, failed_count: failed, skipped_count: skipped, pending_count: pending }],
        }
      }

      if (text.includes('UPDATE sms_scheduled_runs') && text.includes('sent_count = $2')) {
        return {
          rowCount: 1,
          rows: [{ scheduled_message_id: 1, campaign_id: 100, scheduled_run_at: new Date().toISOString() }],
        }
      }

      if (text.includes('FROM sms_recipients') && text.includes('campaign_id = $1')) {
        return {
          rowCount: 1,
          rows: [{ success_count: 0, fail_count: 0, skipped_count: 1 }],
        }
      }

      if (text.includes('UPDATE sms_campaigns')) {
        state.campaignUpdated = true
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('FROM sms_scheduled_messages') && text.includes('schedule_type')) {
        return { rowCount: 1, rows: [{ schedule_type: 'once', status: 'active' }] }
      }

      if (text.includes('UPDATE sms_scheduled_messages') && text.includes('last_error_code')) {
        return { rowCount: 1, rows: [] }
      }

      return { rowCount: 0, rows: [] }
    },
  }
}

test('resolveSmsSendWorkerRuntimeConfig uses conservative defaults', () => {
  const config = resolveSmsSendWorkerRuntimeConfig({})
  assert.equal(config.batchSize, 20)
  assert.equal(config.concurrency, 1)
  assert.equal(config.rateLimitPerMinute, 30)
  assert.equal(config.pollIntervalMs, 5000)
  assert.equal(config.idleBackoffMs, 10000)
  assert.equal(config.staleLockMinutes, 10)
})

test('runSmsSendWorkerOnce skips claim when shouldStop is true', async () => {
  let claimAttempted = false
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('WITH picked AS')) {
        claimAttempted = true
      }
      return { rowCount: 0, rows: [] }
    },
  }
  const result = await runSmsSendWorkerOnce(pool, { shouldStop: () => true, manageSignals: false })
  assert.equal(result.stopped, true)
  assert.equal(claimAttempted, false)
})

test('recoverStaleProcessingJobs moves stale processing jobs to retry', async () => {
  const state = {
    jobs: [
      {
        id: 'job-stale',
        status: 'processing',
        attempt_count: 1,
        max_attempts: 3,
        locked_at: new Date(Date.now() - 20 * 60_000).toISOString(),
        locked_by: 'old-worker',
      },
    ],
  }
  const pool = createWorkerMockPool(state)
  const recovered = await recoverStaleProcessingJobs(pool, { staleLockMinutes: 10 })
  assert.equal(recovered, 1)
  assert.equal(state.jobs[0].status, 'retry')
  assert.equal(state.jobs[0].error_code, 'stale_lock_recovered')
  assert.equal(state.jobs[0].locked_by, null)
})

test('recoverStaleProcessingJobs marks stale jobs failed when max attempts reached', async () => {
  const state = {
    jobs: [
      {
        id: 'job-stale-failed',
        status: 'processing',
        attempt_count: 3,
        max_attempts: 3,
        locked_at: new Date(Date.now() - 20 * 60_000).toISOString(),
        locked_by: 'old-worker',
      },
    ],
  }
  const pool = createWorkerMockPool(state)
  const recovered = await recoverStaleProcessingJobs(pool, { staleLockMinutes: 10 })
  assert.equal(recovered, 1)
  assert.equal(state.jobs[0].status, 'failed')
  assert.equal(state.jobs[0].error_code, 'stale_lock_failed')
})

test('createSendRateLimiter waits when per-minute limit exceeded', async () => {
  const sleeps = []
  const limiter = createSendRateLimiter(2, async (ms) => {
    sleeps.push(ms)
  })
  await limiter.waitForSlot()
  await limiter.waitForSlot()
  await limiter.waitForSlot()
  assert.equal(sleeps.length, 1)
  assert.ok(sleeps[0] > 0)
})

test('runSmsSendWorkerPersistent loops with idle backoff', async () => {
  const sleeps = []
  const pool = createWorkerMockPool({ jobs: [], runs: [], deliveries: [] })
  const result = await runSmsSendWorkerPersistent(pool, {
    maxIterations: 2,
    manageSignals: false,
    idleBackoffMs: 250,
    pollIntervalMs: 100,
    sleepFn: async (ms) => {
      sleeps.push(ms)
    },
  })
  assert.equal(result.iterations, 2)
  assert.equal(sleeps.length, 2)
  assert.equal(sleeps[0], 250)
  assert.equal(sleeps[1], 250)
})

test('runSmsSendWorkerPersistent stops when shouldStop becomes true', async () => {
  let loopCount = 0
  const pool = createWorkerMockPool({ jobs: [], runs: [], deliveries: [] })
  const result = await runSmsSendWorkerPersistent(pool, {
    manageSignals: false,
    idleBackoffMs: 1,
    sleepFn: async () => {
      loopCount += 1
    },
    shouldStop: () => loopCount >= 1,
  })
  assert.equal(result.stopped, true)
  assert.equal(result.iterations, 1)
})

test('claimSmsSendJobs claims queued jobs once', async () => {
  const state = {
    jobs: [
      {
        id: 'job-1',
        tenant_id: 1,
        user_id: 'user-a',
        source_type: 'scheduled',
        source_id: '1',
        run_id: 'run-1',
        campaign_id: 100,
        customer_id: 10,
        phone: '01012345678',
        sender_number: '01011112222',
        message_body: 'hello',
        message_type: 'SMS',
        is_advertising: false,
        status: 'queued',
        attempt_count: 0,
        max_attempts: 3,
        scheduled_for: new Date().toISOString(),
        locked: false,
      },
    ],
    runs: [{ id: 'run-1', scheduled_run_at: new Date().toISOString() }],
    deliveries: [],
  }
  const pool = createWorkerMockPool(state)
  const claimed = await claimSmsSendJobs(pool, { batchSize: 5, workerId: 'worker-a' })
  assert.equal(claimed.length, 1)
  assert.equal(state.jobs[0].status, 'processing')

  const claimedAgain = await claimSmsSendJobs(pool, { batchSize: 5, workerId: 'worker-b' })
  assert.equal(claimedAgain.length, 0)
})

test('two workers cannot claim the same queued job', async () => {
  const state = {
    jobs: [
      {
        id: 'job-shared',
        status: 'queued',
        locked: false,
      },
    ],
  }
  const pool = createWorkerMockPool(state)
  const first = await claimSmsSendJobs(pool, { batchSize: 1, workerId: 'worker-a' })
  const second = await claimSmsSendJobs(pool, { batchSize: 1, workerId: 'worker-b' })
  assert.equal(first.length, 1)
  assert.equal(second.length, 0)
})

test('sent jobs are not claimed again', async () => {
  const state = {
    jobs: [
      {
        id: 'job-sent',
        status: 'sent',
        locked: false,
      },
    ],
  }
  const pool = createWorkerMockPool(state)
  const claimed = await claimSmsSendJobs(pool, { batchSize: 5, workerId: 'worker-a' })
  assert.equal(claimed.length, 0)
})

test('runSmsSendWorkerOnce skips provider when real send disabled', async () => {
  const state = {
    jobs: [
      {
        id: 'job-2',
        tenant_id: 1,
        user_id: 'user-a',
        source_type: 'scheduled',
        source_id: '1',
        run_id: 'run-2',
        campaign_id: 100,
        customer_id: 10,
        phone: '01012345678',
        sender_number: '01011112222',
        message_body: 'hello',
        message_type: 'SMS',
        is_advertising: false,
        status: 'queued',
        attempt_count: 0,
        max_attempts: 3,
        scheduled_for: new Date().toISOString(),
        locked: false,
      },
    ],
    runs: [{ id: 'run-2', scheduled_run_at: new Date().toISOString() }],
    deliveries: [],
  }
  const pool = createWorkerMockPool(state)
  const result = await runSmsSendWorkerOnce(pool, { batchSize: 5, manageSignals: false })
  assert.equal(result.claimed, 1)
  assert.equal(result.skipped, 1)
  assert.equal(state.jobs[0].status, 'skipped')
  assert.equal(state.jobs[0].error_code, 'real_send_disabled')
  assert.equal(state.deliveries.length, 1)
  assert.equal(state.deliveries[0].status, 'skipped')
})

test('runSmsSendWorkerOnce marks skipped for invalid phone when real send enabled', async () => {
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
  const state = {
    jobs: [
      {
        id: 'job-3',
        tenant_id: 1,
        user_id: 'user-a',
        source_type: 'scheduled',
        source_id: '1',
        run_id: 'run-3',
        campaign_id: 100,
        customer_id: 10,
        phone: '',
        sender_number: '01011112222',
        message_body: 'hello',
        message_type: 'SMS',
        is_advertising: false,
        status: 'queued',
        attempt_count: 0,
        max_attempts: 1,
        scheduled_for: new Date().toISOString(),
        locked: false,
      },
    ],
    runs: [{ id: 'run-3', scheduled_run_at: new Date().toISOString() }],
    deliveries: [],
  }
  const pool = createWorkerMockPool(state)
  const result = await runSmsSendWorkerOnce(pool, { batchSize: 5, manageSignals: false })
  assert.equal(result.skipped, 1)
  assert.equal(state.jobs[0].status, 'skipped')
  assert.equal(state.jobs[0].error_code, 'invalid_phone')
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
})
