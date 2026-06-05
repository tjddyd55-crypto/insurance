import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCustomerMappingToValues } from './pdf-engine/mapping/resolvePdfFieldValue.js'

/**
 * render-preview customerId 없음/미발견 시 서버가 입력값만으로 진행하는지 검증.
 * resolvePdfValuesWithCustomerMapping 은 내부 함수이므로 동일 분기 결과를 매핑 함수로 대리 검증한다.
 */

const fields = [
  {
    fieldKey: 'customer_name',
    fieldType: 'text',
    dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name' },
  },
  {
    fieldKey: 'memo',
    fieldType: 'text',
    dataMapping: { dataSourceType: 'manual' },
  },
  {
    fieldKey: 'car_number',
    fieldType: 'text',
    dataMapping: { dataSourceType: 'customer', customerFieldKey: 'carNumber' },
  },
]

test('applyCustomerMappingToValues: customer null keeps manual values (preview without customer)', () => {
  const values = { customer_name: '', memo: '유지', car_number: '12가3456' }
  const out = applyCustomerMappingToValues(fields, values, null, { overwriteMode: false })
  assert.equal(out.memo, '유지')
  assert.equal(out.car_number, '12가3456')
  assert.equal(out.customer_name, '')
})

test('applyCustomerMappingToValues: customer null overwrite still skips customer fields', () => {
  const values = { customer_name: '수기', memo: '유지', car_number: '' }
  const out = applyCustomerMappingToValues(fields, values, null, { overwriteMode: true })
  assert.equal(out.customer_name, '수기')
  assert.equal(out.memo, '유지')
  assert.equal(out.car_number, '')
})
