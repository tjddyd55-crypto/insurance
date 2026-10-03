import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyMappingChangeFromText,
  detectNaturalLanguageCommitIntent,
  parseDuplicatePolicyIntent,
  parseMappingChangeIntent,
} from './followUpIntent.js'
import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../shared/ai-assistant/customer-import/constants.js'

describe('follow-up intent parsing', () => {
  it('parses mapping change', () => {
    const intent = parseMappingChangeIntent('회사 컬럼은 메모로 넣어줘')
    assert.ok(intent)
    assert.equal(intent.sourceHeader, '회사')
    assert.equal(intent.destinationToken, '메모')
  })

  it('applies mapping to session columns', () => {
    const next = applyMappingChangeFromText('회사 컬럼은 메모로 바꿔', ['성명', '회사'], {})
    assert.equal(next.col_1, 'memo')
  })

  it('parses duplicate skip/include', () => {
    assert.equal(parseDuplicatePolicyIntent('중복은 빼줘'), CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP)
    assert.equal(parseDuplicatePolicyIntent('중복도 포함해'), CUSTOMER_IMPORT_DUPLICATE_POLICY.INCLUDE)
  })

  it('detects natural language commit without allowing server commit', () => {
    assert.equal(detectNaturalLanguageCommitIntent('등록해'), true)
    assert.equal(detectNaturalLanguageCommitIntent('고객 찾기'), false)
  })
})
