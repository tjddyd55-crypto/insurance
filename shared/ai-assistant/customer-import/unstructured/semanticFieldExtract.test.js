import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapSemanticToImportFields } from './mapSemanticToImportFields.js'
import { parseUnstructuredBlockToSemantic } from './semanticFieldExtract.js'

const SAMPLE_BLOCK = `강지영
주민번호: 840210-1234567
키/몸무게: 169/52
핸드폰번호: 010-2902-7177
주소: 창원시 마산합포구 교방서1길 39
직업: 주부
차번호: 12가3456`

describe('semanticFieldExtract', () => {
  it('decomposes block into semantic fields before DB mapping', () => {
    const semantic = parseUnstructuredBlockToSemantic(SAMPLE_BLOCK)
    assert.equal(semantic.personName, '강지영')
    assert.equal(semantic.residentRegistrationNumber, '8402101234567')
    assert.deepEqual(semantic.phones, ['01029027177'])
    assert.equal(semantic.address, '창원시 마산합포구 교방서1길 39')
    assert.equal(semantic.height, '169')
    assert.equal(semantic.weight, '52')
    assert.equal(semantic.job, '주부')
    assert.equal(semantic.carNumber, '12가3456')
    assert.equal(semantic.unresolvedLines.length, 0)
  })

  it('maps semantic fields to ONE FC import keys without raw block fallbacks', () => {
    const semantic = parseUnstructuredBlockToSemantic(SAMPLE_BLOCK)
    const { mapped, classification } = mapSemanticToImportFields(semantic)
    assert.equal(mapped.name, '강지영')
    assert.equal(mapped.phone, '01029027177')
    assert.equal(mapped.ssn, '8402101234567')
    assert.equal(mapped.address, '창원시 마산합포구 교방서1길 39')
    assert.equal(mapped.job, '주부')
    assert.equal(mapped.carNumber, '12가3456')
    assert.notEqual(mapped.name, SAMPLE_BLOCK)
    assert.equal(classification, 'CUSTOMER_CANDIDATE')
  })

  it('never uses raw block as name on single-line input', () => {
    const oneLine =
      '강지영 주민번호: 840210-1234567 핸드폰번호: 010-2902-7177 주소: 창원시 마산합포구 교방서1길 39'
    const semantic = parseUnstructuredBlockToSemantic(oneLine)
    assert.equal(semantic.personName, '강지영')
    const { mapped } = mapSemanticToImportFields(semantic)
    assert.equal(mapped.name, '강지영')
    assert.ok(!mapped.memo?.includes('주민번호'))
  })
})
