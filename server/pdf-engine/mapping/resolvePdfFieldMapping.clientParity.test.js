import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFieldDataMapping } from '../schema/fieldDataMapping.js'

/**
 * 프론트 normalizePdfFieldDataMapping 과 동일하게 레거시 문자열을 고객 매칭으로 복원해야 한다.
 * (클라이언트는 server parseFieldDataMapping 과 동기화된 LEGACY 키를 사용한다.)
 */

test('legacy carNumber string is customer mapping not manual', () => {
  const m = parseFieldDataMapping('carNumber')
  assert.equal(m.dataSourceType, 'customer')
  assert.equal(m.customerFieldKey, 'carNumber')
})

test('undefined mapping is manual default', () => {
  const m = parseFieldDataMapping(undefined)
  assert.equal(m.dataSourceType, 'manual')
  assert.equal(m.customerFieldKey, null)
})
