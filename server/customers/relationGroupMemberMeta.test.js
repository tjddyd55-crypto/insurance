/**
 * formatRelationGroupMemberMetaLine / formatCustomerBirthDateDot 계약 검증.
 * 구현은 src/features/customers/utils/customerDisplayFormat.ts — 변경 시 동기화.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function formatCustomerBirthDateDot(raw) {
  if (raw == null || raw === '') return ''
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}.${m}.${d}`
  }
  const s = String(raw).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}.${iso[2]}.${iso[3]}`
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1]}.${compact[2]}.${compact[3]}`
  return ''
}

function formatCustomerGenderReadLabel(gender) {
  if (gender === 'male') return '남'
  if (gender === 'female') return '여'
  return '-'
}

function formatRelationGroupMemberMetaLine(input) {
  const parts = []
  parts.push(String(input.relationshipLabel ?? '').trim() || '관계 미지정')
  const genderLabel = formatCustomerGenderReadLabel(input.gender ?? null)
  if (genderLabel && genderLabel !== '-') parts.push(genderLabel)
  const birth = formatCustomerBirthDateDot(input.birthDate ?? null)
  if (birth) parts.push(birth)
  return parts.join(' · ')
}

describe('formatRelationGroupMemberMetaLine', () => {
  it('formats relation · gender · birthDate', () => {
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '배우자',
        gender: 'female',
        birthDate: '1983-06-03',
      }),
      '배우자 · 여 · 1983.06.03',
    )
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '본인',
        gender: 'male',
        birthDate: '1977-07-25',
      }),
      '본인 · 남 · 1977.07.25',
    )
  })

  it('omits missing gender or birth without dangling separators', () => {
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '배우자',
        gender: null,
        birthDate: '1983-06-03',
      }),
      '배우자 · 1983.06.03',
    )
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '배우자',
        gender: 'female',
        birthDate: null,
      }),
      '배우자 · 여',
    )
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '배우자',
        gender: null,
        birthDate: null,
      }),
      '배우자',
    )
  })

  it('source uses formatRelationGroupMemberMetaLine and not phone in member meta', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(
      join(dir, '../../src/features/customers/components/CustomerRelationGroupsSection.tsx'),
      'utf8',
    )
    assert.match(src, /formatRelationGroupMemberMetaLine/)
    const metaBlock = src.slice(src.indexOf('customer-relation-group-member__meta'))
    const rowMeta = metaBlock.slice(0, 200)
    assert.equal(rowMeta.includes('formatCustomerPhoneUi'), false)
  })
})

describe('formatCustomerBirthDateDot', () => {
  it('formats ISO and compact dates as YYYY.MM.DD', () => {
    assert.equal(formatCustomerBirthDateDot('1983-06-03'), '1983.06.03')
    assert.equal(formatCustomerBirthDateDot('19830603'), '1983.06.03')
    assert.equal(formatCustomerBirthDateDot(''), '')
    assert.equal(formatCustomerBirthDateDot(null), '')
  })
})

describe('relation group member birthDate resolve SSOT', () => {
  it('uses resolveCustomerBirthDateYmd when birth_date is null but ssn exists', async () => {
    const { resolveCustomerBirthDateYmd } = await import('../lib/customerBirthDateResolve.js')
    // 840218-1… → 1984-02-18 (검색 목록과 동일 SSOT)
    assert.equal(
      resolveCustomerBirthDateYmd({ birth_date: null, ssn: '8402181******' }),
      '1984-02-18',
    )
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '본인',
        gender: 'male',
        birthDate: resolveCustomerBirthDateYmd({ birth_date: null, ssn: '8402181******' }),
      }),
      '본인 · 남 · 1984.02.18',
    )
    assert.equal(
      formatRelationGroupMemberMetaLine({
        relationshipLabel: '어머니',
        gender: 'female',
        birthDate: resolveCustomerBirthDateYmd({ birth_date: null, ssn: '6204102******' }),
      }),
      '어머니 · 여 · 1962.04.10',
    )
  })

  it('prefers birth_date column over ssn', async () => {
    const { resolveCustomerBirthDateYmd } = await import('../lib/customerBirthDateResolve.js')
    assert.equal(
      resolveCustomerBirthDateYmd({ birth_date: '1983-06-03', ssn: '8402181******' }),
      '1983-06-03',
    )
  })
})
