import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { NO_ACTIVE_PUSH_DEVICES_ERROR, PUSH_OUTBOX_STATUS } from './pushOutboxService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPushOutboxServiceSource() {
  return readFileSync(join(__dirname, 'pushOutboxService.js'), 'utf8')
}

describe('pushOutboxService delivery guards', () => {
  it('exports a stable no-device error code', () => {
    assert.equal(NO_ACTIVE_PUSH_DEVICES_ERROR, 'no_active_push_devices')
  })

  it('exports frozen terminal statuses', () => {
    assert.deepEqual(PUSH_OUTBOX_STATUS, { SENT: 'SENT', NO_DEVICE: 'NO_DEVICE', FAILED: 'FAILED' })
    assert.ok(Object.isFrozen(PUSH_OUTBOX_STATUS))
  })

  it('returns zero delivery counts when no active push devices are registered', () => {
    const src = readPushOutboxServiceSource()
    assert.match(src, /if \(devices\.length === 0\) \{\s*return \{ attempted: 0, delivered: 0 \}/)
    assert.doesNotMatch(src, /if \(devices\.length === 0\) \{\s*return\s*\}/)
  })

  it('counts successful sends and excludes revoked tokens from delivery counts', () => {
    const src = readPushOutboxServiceSource()
    assert.match(src, /let delivered = 0/)
    assert.match(src, /await messaging\.send\(message\)\s*delivered \+= 1/)
    assert.match(src, /await revokePushDeviceByToken\(pool, device\.device_token, gaId\)\s*continue/)
    assert.match(src, /throw error/)
    assert.match(src, /return \{ attempted: devices\.length, delivered \}/)
  })

  it('marks SENT and increments processed only after a successful delivery', () => {
    const src = readPushOutboxServiceSource()
    assert.match(src, /const \{ delivered \} = await deliverOutboxRow/)
    assert.match(src, /if \(delivered > 0\) \{\s*await safeQuery\([\s\S]*?SET status = 'SENT', sent_at = NOW\(\), last_error = NULL, updated_at = NOW\(\)[\s\S]*?processed \+= 1\s*\} else \{/)
  })

  it('records NO_DEVICE without consuming an attempt or scheduling a retry', () => {
    const src = readPushOutboxServiceSource()
    const noDeviceBranch = src.match(/\} else \{([\s\S]*?)\}\s*\} catch \(error\)/)?.[1]
    assert.ok(noDeviceBranch)
    assert.match(noDeviceBranch, /SET status = 'NO_DEVICE', sent_at = NULL, last_error = \$3, updated_at = NOW\(\)/)
    assert.match(noDeviceBranch, /\[row\.id, gaId, NO_ACTIVE_PUSH_DEVICES_ERROR\]/)
    assert.match(noDeviceBranch, /noDevice \+= 1/)
    assert.doesNotMatch(noDeviceBranch, /attempt_count|next_attempt_at|processed \+=/)
    assert.match(src, /AND status IN \('PENDING', 'FAILED'\)/)
    assert.match(src, /return \{ processed, noDevice, skipped: false, gaCount: gaIds\.length \}/)
  })
})
