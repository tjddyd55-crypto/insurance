import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHUBB_LIFE_DIRECTORY_STUB,
  FUBON_HYUNDAI_LIFE_DIRECTORY_STUB,
  companyCodeForFubonGa,
  isChubbLifeCompanyName,
  isFubonHyundaiLifeCompanyName,
  normalizeInsuranceCompanyNameKey,
} from './ensureInsuranceCompanyDirectoryStubs.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('normalizeInsuranceCompanyNameKey: 공백·대소문자 무시', () => {
  assert.equal(normalizeInsuranceCompanyNameKey(' Chubb Life '), 'chubblife')
  assert.equal(normalizeInsuranceCompanyNameKey('처브생명'), '처브생명')
  assert.equal(normalizeInsuranceCompanyNameKey('Fubon Hyundai Life'), 'fubonhyundailife')
})

test('isChubbLifeCompanyName: 처브 표기 변형 인식', () => {
  assert.equal(isChubbLifeCompanyName('처브생명'), true)
  assert.equal(isChubbLifeCompanyName('처브라이프'), true)
  assert.equal(isChubbLifeCompanyName('처브라이프생명'), true)
  assert.equal(isChubbLifeCompanyName('Chubb Life'), true)
  assert.equal(isChubbLifeCompanyName('삼성생명'), false)
})

test('CHUBB_LIFE_DIRECTORY_STUB: 생명보험·빈 연락처', () => {
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.category, 'LIFE')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.name, '처브생명')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.customer_center, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.system_phone, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.incall_number, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.contacts.length, 0)
})

test('isFubonHyundaiLifeCompanyName: 푸본현대·현대라이프 표기 인식', () => {
  assert.equal(isFubonHyundaiLifeCompanyName('푸본현대생명'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('푸본현대'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('푸본현대생명보험'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('현대라이프'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('현대라이프생명'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('Fubon Hyundai Life'), true)
  assert.equal(isFubonHyundaiLifeCompanyName('푸본생명'), false)
  assert.equal(isFubonHyundaiLifeCompanyName('한화생명'), false)
})

test('FUBON_HYUNDAI_LIFE_DIRECTORY_STUB: LIFE·공식 고객센터', () => {
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.category, 'LIFE')
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.name, '푸본현대생명')
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.companyCode, 'INS_SEED_011')
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.customer_center, '1577-3311')
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.homepageUrl, 'https://www.fubonhyundai.com/')
  assert.equal(FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.contacts.length, 0)
})

test('companyCodeForFubonGa: YJASSET 은 시드 코드, 그 외 GA 는 고유 코드', () => {
  assert.equal(companyCodeForFubonGa(7, 7), 'INS_SEED_011')
  assert.equal(companyCodeForFubonGa(12, 7), 'INS_FHL_12')
})

test('seedInsuranceFullData includes Fubon Hyundai Life once', () => {
  const src = readFileSync(path.join(repoRoot, 'server/seedInsuranceFullData.js'), 'utf8')
  const matches = src.match(/name:\s*'푸본현대생명'/g) ?? []
  assert.equal(matches.length, 1)
  assert.match(src, /companyCode:\s*'INS_SEED_011'/)
  assert.match(src, /customer_center:\s*'1577-3311'/)
})

test('insurer sites seed uses official fubonhyundai.com homepage', () => {
  const src = readFileSync(path.join(repoRoot, 'server/insurerSitesSeedData.js'), 'utf8')
  assert.match(src, /name:\s*'푸본현대생명'[\s\S]*?homepageUrl:\s*'https:\/\/www\.fubonhyundai\.com\/'/)
  assert.doesNotMatch(src, /fubonhyundailife\.com/)
})
