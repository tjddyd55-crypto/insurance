import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseUnstructuredCellDeterministic } from './deterministicCellParse.js'

const SAMPLE_BLOCK = `강지영
주민번호: 840210-1234567
키/몸무게: 169/52
핸드폰번호: 010-2902-7177
주소: 창원시 마산합포구 교방서1길 39
직업: 주부`

describe('parseUnstructuredCellDeterministic', () => {
  it('splits person name from multi-line block — never uses raw block as name', () => {
    const parsed = parseUnstructuredCellDeterministic('고객정보', 0, 0, SAMPLE_BLOCK)
    assert.equal(parsed.records.length, 1)
    const rec = parsed.records[0]
    assert.equal(rec.name, '강지영')
    assert.notEqual(rec.name, SAMPLE_BLOCK)
    assert.ok(!rec.name.includes('주민번호'))
    assert.equal(rec.phone, '01029027177')
    assert.equal(rec.address, '창원시 마산합포구 교방서1길 39')
  })

  it('extracts leading name from single-line labeled block', () => {
    const oneLine =
      '강지영 주민번호: 840210-1234567 핸드폰번호: 010-2902-7177 주소: 창원시 마산합포구 교방서1길 39'
    const parsed = parseUnstructuredCellDeterministic('고객정보', 1, 0, oneLine)
    assert.equal(parsed.records[0].name, '강지영')
    assert.notEqual(parsed.records[0].name, oneLine)
  })

  it('does not invent name when only labels exist', () => {
    const parsed = parseUnstructuredCellDeterministic(
      '고객정보',
      2,
      0,
      '주민번호: 840210-1234567\n핸드폰번호: 010-2902-7177',
    )
    assert.equal(parsed.records[0].name, '')
    assert.equal(parsed.records[0].classification, 'REVIEW_REQUIRED')
  })
})
