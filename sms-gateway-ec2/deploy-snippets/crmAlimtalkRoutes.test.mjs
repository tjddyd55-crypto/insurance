import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  normalizeTestMode,
  pickInfo,
  pickMid,
} = require('./crmAlimtalkRoutes.cjs')

describe('crmAlimtalkRoutes (EC2 CJS SSOT)', () => {
  it('normalizes testMode false → N and true → Y', () => {
    assert.equal(normalizeTestMode(false), 'N')
    assert.equal(normalizeTestMode('false'), 'N')
    assert.equal(normalizeTestMode(0), 'N')
    assert.equal(normalizeTestMode(null), 'N')
    assert.equal(normalizeTestMode(true), 'Y')
    assert.equal(normalizeTestMode('Y'), 'Y')
    assert.equal(normalizeTestMode('true'), 'Y')
  })

  it('extracts info.mid and summary fields', () => {
    const raw = {
      code: 0,
      message: 'ok',
      info: { mid: '1401398459', type: 'AT', scnt: 1, fcnt: 0, pcnt: 0, total: 1 },
    }
    assert.equal(pickMid(raw), '1401398459')
    assert.deepEqual(pickInfo(raw), {
      mid: '1401398459',
      type: 'AT',
      scnt: 1,
      fcnt: 0,
      pcnt: 0,
      total: 1,
      unit: null,
    })
  })
})
