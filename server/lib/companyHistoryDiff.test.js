import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collapseCompanyHistoryByDateAndCompany,
  getHistoryCompanyGroupKey,
  isHistoryContactFieldChanged,
  isHistoryPhoneChanged,
  isHistoryTextChanged,
  pairHistoryContacts,
  pickLatestHistoryEntry,
  sortCompanyContactsByInputOrder,
} from './companyHistoryDiff.js'

describe('companyHistoryDiff', () => {
  it('phone hyphen difference is not changed', () => {
    assert.equal(isHistoryPhoneChanged('010-4757-7209', '01047577209'), false)
    assert.equal(isHistoryPhoneChanged('010 4757 7209', '01047577209'), false)
  })

  it('changed phone is marked changed', () => {
    assert.equal(isHistoryPhoneChanged('010-1111-2222', '010-3333-4444'), true)
  })

  it('changed name is marked changed', () => {
    assert.equal(isHistoryTextChanged('홍길동', '김철수'), true)
    assert.equal(isHistoryTextChanged(' 홍길동 ', '홍길동'), false)
  })

  it('unchanged value is not changed', () => {
    assert.equal(isHistoryTextChanged('고객센터', '고객센터'), false)
    assert.equal(isHistoryPhoneChanged('', ''), false)
  })

  it('newly added contact is marked changed', () => {
    const pairs = pairHistoryContacts(
      [],
      [{ position: '지점장', name: '김철수', phone: '010-1234-5678' }],
    )
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].isNew, true)
    assert.equal(
      isHistoryContactFieldChanged('name', pairs[0].before, pairs[0].after, { isNew: true }),
      true,
    )
    assert.equal(
      isHistoryContactFieldChanged('phone', pairs[0].before, pairs[0].after, { isNew: true }),
      true,
    )
  })

  it('pairs contacts by position role key', () => {
    const pairs = pairHistoryContacts(
      [{ position: '지점장', name: '이전', phone: '010-1111-1111' }],
      [{ position: '지점장', name: '이후', phone: '010-2222-2222' }],
    )
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].isNew, false)
    assert.equal(isHistoryTextChanged(pairs[0].before.name, pairs[0].after.name), true)
  })

  it('preserves after snapshot staff input order for display', () => {
    const after = [
      { position: '총무', name: 'A', phone: '010-1111-1111' },
      { position: '지점장', name: 'B', phone: '010-2222-2222' },
      { position: '설계매니저', name: 'C', phone: '010-3333-3333' },
    ]
    const pairs = pairHistoryContacts([], after)
    assert.deepEqual(
      pairs.map((pair) => pair.after.position),
      ['총무', '지점장', '설계매니저'],
    )
  })

  it('uses displayOrder when present', () => {
    const rows = sortCompanyContactsByInputOrder([
      { position: '지점장', name: 'B', displayOrder: 2 },
      { position: '총무', name: 'A', displayOrder: 0 },
      { position: '설계매니저', name: 'C', displayOrder: 1 },
    ])
    assert.deepEqual(
      rows.map((row) => row.position),
      ['총무', '설계매니저', '지점장'],
    )
  })

  it('keeps changed flags after staff order sort', () => {
    const pairs = pairHistoryContacts(
      [{ position: '지점장', name: '이전', phone: '010-1111-1111' }],
      [
        { position: '총무', name: '신규', phone: '010-0000-0000' },
        { position: '지점장', name: '이후', phone: '010-2222-2222' },
      ],
    )
    assert.deepEqual(
      pairs.map((pair) => pair.after.position),
      ['총무', '지점장'],
    )
    const branchPair = pairs.find((pair) => pair.after.position === '지점장')
    assert.ok(branchPair)
    assert.equal(branchPair.isNew, false)
    assert.equal(
      isHistoryContactFieldChanged('name', branchPair.before, branchPair.after, { isNew: false }),
      true,
    )
    const newPair = pairs.find((pair) => pair.after.position === '총무')
    assert.ok(newPair)
    assert.equal(newPair.isNew, true)
  })

  it('phone hyphen difference stays unchanged after ordering', () => {
    const pairs = pairHistoryContacts(
      [{ position: '지점장', name: '홍길동', phone: '010-1111-1111' }],
      [
        { position: '총무', name: '김철수', phone: '010-3333-3333' },
        { position: '지점장', name: '홍길동', phone: '01011111111' },
      ],
    )
    const branchPair = pairs.find((pair) => pair.after.position === '지점장')
    assert.ok(branchPair)
    assert.equal(
      isHistoryContactFieldChanged('phone', branchPair.before, branchPair.after, { isNew: false }),
      false,
    )
  })

  it('collapses same date and same company to latest entry only', () => {
    const entries = [
      {
        id: '1',
        companyId: '10',
        companyName: 'MG손보',
        category: 'NON_LIFE',
        updatedAt: '2026-06-24',
        savedAt: '2026-06-24T01:10:00.000Z',
        before: { customerCenter: '1', system: '', incall: '', visitInfo: '', contacts: [] },
        after: { customerCenter: '2', system: '', incall: '', visitInfo: '', contacts: [] },
      },
      {
        id: '2',
        companyId: '10',
        companyName: 'MG손보',
        category: 'NON_LIFE',
        updatedAt: '2026-06-24',
        savedAt: '2026-06-24T01:20:00.000Z',
        before: { customerCenter: '2', system: '', incall: '', visitInfo: '', contacts: [] },
        after: { customerCenter: '3', system: '', incall: '', visitInfo: '', contacts: [] },
      },
    ]
    const collapsed = collapseCompanyHistoryByDateAndCompany(entries)
    assert.equal(collapsed.length, 1)
    assert.equal(collapsed[0].id, '2')
    assert.equal(collapsed[0].after.customerCenter, '3')
  })

  it('keeps different companies on the same date', () => {
    const entries = [
      {
        id: '1',
        companyId: '10',
        companyName: 'MG손보',
        updatedAt: '2026-06-24',
        savedAt: '2026-06-24T01:00:00.000Z',
      },
      {
        id: '2',
        companyId: '11',
        companyName: '삼성화재',
        updatedAt: '2026-06-24',
        savedAt: '2026-06-24T02:00:00.000Z',
      },
    ]
    const collapsed = collapseCompanyHistoryByDateAndCompany(entries)
    assert.equal(collapsed.length, 2)
    assert.deepEqual(
      collapsed.map((entry) => entry.companyName).sort(),
      ['MG손보', '삼성화재'],
    )
  })

  it('keeps same company across different dates', () => {
    const entries = [
      {
        id: '1',
        companyId: '10',
        companyName: 'MG손보',
        updatedAt: '2026-06-23',
        savedAt: '2026-06-23T01:00:00.000Z',
      },
      {
        id: '2',
        companyId: '10',
        companyName: 'MG손보',
        updatedAt: '2026-06-24',
        savedAt: '2026-06-24T01:00:00.000Z',
      },
    ]
    const collapsed = collapseCompanyHistoryByDateAndCompany(entries)
    assert.equal(collapsed.length, 2)
    assert.deepEqual(
      collapsed.map((entry) => entry.updatedAt),
      ['2026-06-24', '2026-06-23'],
    )
  })

  it('uses category and company name when companyId is missing', () => {
    const key = getHistoryCompanyGroupKey({
      updatedAt: '2026-06-24',
      category: 'NON_LIFE',
      companyName: 'MG손보',
    })
    assert.equal(key, '2026-06-24:NON_LIFE:MG손보')
  })

  it('latest collapsed entry keeps changed flags and staff order', () => {
    const latest = pickLatestHistoryEntry([
      {
        id: '1',
        savedAt: '2026-06-24T01:00:00.000Z',
        before: {
          contacts: [{ position: '지점장', name: '이전', phone: '010-1111-1111' }],
        },
        after: {
          contacts: [{ position: '지점장', name: '중간', phone: '010-1111-1111' }],
        },
      },
      {
        id: '2',
        savedAt: '2026-06-24T02:00:00.000Z',
        before: {
          contacts: [{ position: '지점장', name: '중간', phone: '010-1111-1111' }],
        },
        after: {
          contacts: [
            { position: '총무', name: '신규', phone: '010-0000-0000' },
            { position: '지점장', name: '최종', phone: '01011111111' },
          ],
        },
      },
    ])
    assert.ok(latest)
    assert.equal(latest.id, '2')
    const pairs = pairHistoryContacts(latest.before.contacts, latest.after.contacts)
    assert.deepEqual(
      pairs.map((pair) => pair.after.position),
      ['총무', '지점장'],
    )
    const branchPair = pairs.find((pair) => pair.after.position === '지점장')
    assert.ok(branchPair)
    assert.equal(
      isHistoryContactFieldChanged('name', branchPair.before, branchPair.after, { isNew: false }),
      true,
    )
    assert.equal(
      isHistoryContactFieldChanged('phone', branchPair.before, branchPair.after, { isNew: false }),
      false,
    )
  })
})
