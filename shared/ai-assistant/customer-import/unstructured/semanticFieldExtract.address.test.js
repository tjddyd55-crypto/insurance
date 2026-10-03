import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseUnstructuredBlockToSemantic } from './semanticFieldExtract.js'
import { assessImportAddressQuality } from '../fieldQuality.js'

describe('semantic address boundaries', () => {
  it('stops address before inline phone label on same line', () => {
    const raw = '이름: 홍길동\n주소: 서울 마포구 합정동 핸드폰번호: 010-1111-2222'
    const semantic = parseUnstructuredBlockToSemantic(raw)
    assert.ok(!semantic.address.includes('핸드폰'))
    const quality = assessImportAddressQuality(semantic.address)
    assert.equal(quality.ok, true)
  })
})
