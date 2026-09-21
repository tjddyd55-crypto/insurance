import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { NO_ACTIVE_PUSH_DEVICES_ERROR } from './pushOutboxService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPushOutboxServiceSource() {
  return readFileSync(join(__dirname, 'pushOutboxService.js'), 'utf8')
}

describe('pushOutboxService delivery guards', () => {
  it('exports a stable no-device error code', () => {
    assert.equal(NO_ACTIVE_PUSH_DEVICES_ERROR, 'no_active_push_devices')
  })

  it('fails delivery when no active push devices are registered', () => {
    const src = readPushOutboxServiceSource()
    assert.match(src, /if \(devices\.length === 0\)/)
    assert.match(src, /throw new Error\(NO_ACTIVE_PUSH_DEVICES_ERROR\)/)
    assert.doesNotMatch(src, /if \(devices\.length === 0\) \{\s*return\s*\}/)
  })
})
