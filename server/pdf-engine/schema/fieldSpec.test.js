/**
 * PDF 자동화 엔진 — 스키마 검증 테이블-드리븐 테스트.
 *
 * 이 테스트는 "도메인 계약" 그 자체다 — 통과해야 관리자 UI/렌더러가 신뢰할 수 있다.
 * 실행: `npm test` (node:test, 외부 의존성 없음)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ALLOWED_FIELD_TYPES,
  normalizeFieldSpec,
  normalizeFieldSpecList,
  validateRenderValues,
} from './fieldSpec.js'

function makeField(overrides = {}) {
  return {
    fieldKey: 'name',
    label: '성명',
    fieldType: 'text',
    required: true,
    orderIndex: 0,
    customerMapping: null,
    placements: [{ page: 0, x: 100, y: 200, align: 'left' }],
    ...overrides,
  }
}

test('normalizeFieldSpec: 허용 타입(text/textarea/checkbox/radio) 모두 통과', () => {
  for (const t of ALLOWED_FIELD_TYPES) {
    /* radio 는 options + placement.optionValue 가 있어야 하므로 별도 빌더 사용 */
    if (t === 'radio') {
      const out = normalizeFieldSpec(
        makeField({
          fieldType: 'radio',
          options: ['A', 'B'],
          placements: [{ page: 0, x: 10, y: 10, optionValue: 'A' }],
        }),
      )
      assert.equal(out.fieldType, 'radio')
      assert.deepEqual(out.options, ['A', 'B'])
      assert.equal(out.placements[0].optionValue, 'A')
      continue
    }
    const out = normalizeFieldSpec(makeField({ fieldType: t }))
    assert.equal(out.fieldType, t)
  }
})

test('normalizeFieldSpec: 비허용 타입(select/email) 은 에러', () => {
  for (const t of ['select', 'email']) {
    assert.throws(() => normalizeFieldSpec(makeField({ fieldType: t })), /허용되지 않는/)
  }
})

test('normalizeFieldSpec: radio 는 options 가 최소 1개 필요', () => {
  assert.throws(
    () =>
      normalizeFieldSpec(
        makeField({ fieldType: 'radio', options: [], placements: [{ page: 0, x: 1, y: 1 }] }),
      ),
    /옵션/,
  )
})

test('normalizeFieldSpec: radio placement.optionValue 가 options 에 없으면 에러', () => {
  assert.throws(
    () =>
      normalizeFieldSpec(
        makeField({
          fieldType: 'radio',
          options: ['A'],
          placements: [{ page: 0, x: 1, y: 1, optionValue: 'B' }],
        }),
      ),
    /옵션 목록/,
  )
})

test('normalizeFieldSpec: radio 가 아닌 타입에 options 가 오면 null 로 버림', () => {
  const out = normalizeFieldSpec(
    makeField({ fieldType: 'checkbox', options: ['A', 'B'] }),
  )
  assert.equal(out.options, null)
})

test('normalizeFieldSpec: fieldKey 네이밍 규칙 위반', () => {
  const bad = ['', '1name', 'Name', '이름', 'a'.repeat(65), 'a name']
  for (const key of bad) {
    assert.throws(() => normalizeFieldSpec(makeField({ fieldKey: key })), /key/)
  }
})

test('normalizeFieldSpec: placement.x/y 가 음수이거나 누락이면 에러', () => {
  assert.throws(
    () => normalizeFieldSpec(makeField({ placements: [{ page: 0, x: -1, y: 10 }] })),
    /x.*y/,
  )
  assert.throws(
    () => normalizeFieldSpec(makeField({ placements: [{ page: 0, x: 10 }] })),
    /x.*y/,
  )
})

test('normalizeFieldSpec: align 값 정규화 (허용값 유지, 그 외는 left)', () => {
  const left = normalizeFieldSpec(makeField({ placements: [{ page: 0, x: 1, y: 1, align: 'left' }] }))
  const center = normalizeFieldSpec(
    makeField({ placements: [{ page: 0, x: 1, y: 1, align: 'center' }] }),
  )
  const weird = normalizeFieldSpec(makeField({ placements: [{ page: 0, x: 1, y: 1, align: 'weird' }] }))
  assert.equal(left.placements[0].align, 'left')
  assert.equal(center.placements[0].align, 'center')
  assert.equal(weird.placements[0].align, 'left')
})

test('normalizeFieldSpecList: 배열이 아니면 에러, key 중복 시 에러', () => {
  assert.throws(() => normalizeFieldSpecList({}), /배열/)
  assert.throws(
    () => normalizeFieldSpecList([makeField({ fieldKey: 'x' }), makeField({ fieldKey: 'x' })]),
    /중복/,
  )
})

test('validateRenderValues: 필수 필드 누락은 거부', () => {
  const fields = [normalizeFieldSpec(makeField({ required: true }))]
  const r = validateRenderValues(fields, { name: '   ' })
  assert.equal(r.ok, false)
})

test('validateRenderValues: date 타입은 더 이상 허용되지 않음', () => {
  assert.throws(
    () => normalizeFieldSpec(makeField({ fieldKey: 'dob', fieldType: 'date', required: true })),
    /허용되지 않는/,
  )
})

test('validateRenderValues: 통과 시 값은 trim 된 문자열 맵', () => {
  const fields = [normalizeFieldSpec(makeField({ required: false }))]
  const r = validateRenderValues(fields, { name: '  홍길동  ' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.normalized.name, '홍길동')
})

test('validateRenderValues: checkbox 는 "true"/"false" 만 허용', () => {
  const fields = [
    normalizeFieldSpec(
      makeField({
        fieldKey: 'agree',
        fieldType: 'checkbox',
        required: false,
        placements: [{ page: 0, x: 10, y: 10 }],
      }),
    ),
  ]
  assert.equal(validateRenderValues(fields, { agree: 'true' }).ok, true)
  assert.equal(validateRenderValues(fields, { agree: 'false' }).ok, true)
  assert.equal(validateRenderValues(fields, { agree: '' }).ok, true)
  assert.equal(validateRenderValues(fields, { agree: 'yes' }).ok, false)
})

test('validateRenderValues: checkbox required 는 "true" 만 통과', () => {
  const fields = [
    normalizeFieldSpec(
      makeField({
        fieldKey: 'agree',
        fieldType: 'checkbox',
        required: true,
        placements: [{ page: 0, x: 10, y: 10 }],
      }),
    ),
  ]
  assert.equal(validateRenderValues(fields, { agree: 'true' }).ok, true)
  assert.equal(validateRenderValues(fields, { agree: 'false' }).ok, false)
  assert.equal(validateRenderValues(fields, { agree: '' }).ok, false)
})

test('validateRenderValues: radio 는 options 중 하나여야 함', () => {
  const fields = [
    normalizeFieldSpec(
      makeField({
        fieldKey: 'gender',
        fieldType: 'radio',
        required: true,
        options: ['M', 'F'],
        placements: [
          { page: 0, x: 1, y: 1, optionValue: 'M' },
          { page: 0, x: 2, y: 1, optionValue: 'F' },
        ],
      }),
    ),
  ]
  assert.equal(validateRenderValues(fields, { gender: 'M' }).ok, true)
  assert.equal(validateRenderValues(fields, { gender: 'X' }).ok, false)
  assert.equal(validateRenderValues(fields, { gender: '' }).ok, false)
})
