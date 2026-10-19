import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_VERSION,
} from './advisorConsultationPrivacyPolicy.js'

function extractExportTemplate(source, constName) {
  const marker = `export const ${constName} = \``
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `${constName} template missing`)
  const from = start + marker.length
  const end = source.indexOf('`', from)
  assert.ok(end > from, `${constName} template unclosed`)
  return source.slice(from, end)
}

function extractExportLiteral(source, constName) {
  const match = source.match(new RegExp(`export const ${constName} = '([^']*)'`))
  assert.ok(match, `${constName} literal missing`)
  return match[1]
}

test('consultation consent version is v2 and matches the client copy', () => {
  assert.equal(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_VERSION, 'mobile-card-consultation-v2')
  const client = fs.readFileSync(
    new URL('../../src/features/public-advisor/consultation/consultationPrivacyPolicy.ts', import.meta.url),
    'utf8',
  )
  assert.equal(
    extractExportLiteral(client, 'MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_VERSION'),
    MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_VERSION,
  )
  assert.equal(
    extractExportTemplate(client, 'MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY'),
    MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
  )
})

test('consultation consent matches the privacy page retention and recipient wording', () => {
  assert.match(
    MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
    /법령상 보관 의무가 있는 경우를 제외하고, 수집·이용 목적 달성 시 지체 없이 파기합니다/,
  )
  assert.doesNotMatch(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY, /일정 기간/)
  assert.match(
    MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
    /해당 공개 모바일 명함\(\/fc\/슬러그\)을 운영하는 설계사에게만 전달됩니다/,
  )
  assert.match(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY, /상담 신청 접수가 제한됩니다/)
  assert.match(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY, /접속 IP와 단말 정보는 상담 신청 기록에 저장하지 않습니다/)
})
