import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assessImportNameQuality, violatesAutoEligibleFieldQuality } from './fieldQuality.js'

describe('fieldQuality', () => {
  it('rejects raw block as name', () => {
    const block = '강지영 주민번호: 840210 핸드폰: 010-1111-2222'
    const result = assessImportNameQuality(block, { unstructuredSourceText: block })
    assert.equal(result.ok, false)
  })

  it('accepts isolated Korean given name', () => {
    const result = assessImportNameQuality('강지영', { unstructuredSourceText: '강지영\n주민번호: ...' })
    assert.equal(result.ok, true)
    assert.equal(result.canonicalName, '강지영')
  })

  it('auto-eligible gate flags RRN patterns in name', () => {
    const issues = violatesAutoEligibleFieldQuality(
      { name: '홍길동 840210-1234567', phone: '01012345678', address: '서울' },
      { unstructuredSourceText: 'raw' },
    )
    assert.ok(issues.length > 0)
  })
})
