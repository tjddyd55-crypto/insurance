import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERAL_GA_CODE_CANONICAL,
  isGeneralGaCompanyCode,
  normalizeGaCompanyCode,
} from './generalGa.js'

test('normalizeGaCompanyCode: 대소문자·공백 무시', () => {
  assert.equal(normalizeGaCompanyCode('  general  '), 'GENERAL')
  assert.equal(normalizeGaCompanyCode('General'), 'GENERAL')
  assert.equal(normalizeGaCompanyCode('GENERAL'), 'GENERAL')
})

test('isGeneralGaCompanyCode: GENERAL 변형 모두 true', () => {
  assert.equal(isGeneralGaCompanyCode('general'), true)
  assert.equal(isGeneralGaCompanyCode(' General '), true)
  assert.equal(isGeneralGaCompanyCode(GENERAL_GA_CODE_CANONICAL), true)
  assert.equal(isGeneralGaCompanyCode('YJASSET'), false)
})
