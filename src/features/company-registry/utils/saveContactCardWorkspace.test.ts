import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ContactCompanyCardDraft } from '../domain/contactCardWorkspaceModel'
import {
  applySuccessfulCardSaves,
  isGaExistingCardMetadataChangeBlocked,
  saveContactCardWorkspace,
} from './saveContactCardWorkspace'

vi.mock('../api/companyRegistryApi', () => ({
  fullSaveCompanyDirectory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../contacts/utils/savePersonalRegistryContacts', () => ({
  savePersonalRegistryContacts: vi.fn().mockResolvedValue(undefined),
}))

import { fullSaveCompanyDirectory } from '../api/companyRegistryApi'

function draft(overrides: Partial<ContactCompanyCardDraft> = {}): ContactCompanyCardDraft {
  return {
    cardKey: 'c1',
    category: 'LIFE',
    companyCode: 'INS1',
    companyId: 1,
    companyName: '테스트생명',
    customerCenter: '',
    systemPhone: '',
    incallNumber: '',
    visitInfo: '',
    contacts: [
      { rowKey: 'r1', name: '홍길동', position: '팀장', phone: '010-1111-2222' },
    ],
    isNew: false,
    markedForDeletion: false,
    ...overrides,
  }
}

describe('saveContactCardWorkspace', () => {
  beforeEach(() => {
    vi.mocked(fullSaveCompanyDirectory).mockClear()
  })

  it('baseline과 동일한 카드는 API를 호출하지 않는다', async () => {
    const base = draft()
    const results = await saveContactCardWorkspace({
      token: 't',
      mode: 'ga',
      drafts: [base],
      baseline: [draft()],
      personalContacts: [],
    })
    expect(results).toHaveLength(0)
    expect(fullSaveCompanyDirectory).not.toHaveBeenCalled()
  })

  it('GA 기존 카드의 보험회사·종류 변경은 저장하지 않는다', async () => {
    const base = draft({ companyCode: 'INS1', companyName: '테스트생명' })
    const changedCompany = draft({ companyCode: 'INS9', companyName: '다른생명' })
    const results = await saveContactCardWorkspace({
      token: 't',
      mode: 'ga',
      drafts: [changedCompany],
      baseline: [base],
      personalContacts: [],
    })
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(false)
    expect(fullSaveCompanyDirectory).not.toHaveBeenCalled()
  })

  it('STATIC 코드 카드에는 companyId를 API에 보내지 않는다', async () => {
    const base = draft({
      isNew: true,
      companyCode: 'STATIC:NON_LIFE:농협손해보험',
      companyName: '농협손해보험',
      companyId: 99,
    })
    await saveContactCardWorkspace({
      token: 't',
      mode: 'ga',
      drafts: [base],
      baseline: [],
      personalContacts: [],
    })
    expect(fullSaveCompanyDirectory).toHaveBeenCalledWith(
      expect.objectContaining({
        company: expect.not.objectContaining({ id: expect.anything() }),
      }),
      't',
    )
  })

  it('변경된 카드만 저장한다', async () => {
    const unchanged = draft({
      cardKey: 'c2',
      companyCode: 'INS2',
      companyId: 2,
      companyName: '다른생명',
    })
    const changed = draft({
      contacts: [{ rowKey: 'r1', name: '김철수', position: '팀장', phone: '010-1111-2222' }],
    })
    await saveContactCardWorkspace({
      token: 't',
      mode: 'ga',
      drafts: [changed, unchanged],
      baseline: [draft(), unchanged],
      personalContacts: [],
    })
    expect(fullSaveCompanyDirectory).toHaveBeenCalledTimes(1)
  })
})

describe('isGaExistingCardMetadataChangeBlocked', () => {
  it('담당자만 바뀌면 false', () => {
    const base = draft()
    const edited = draft({
      contacts: [{ rowKey: 'r1', name: '변경', position: '', phone: '010-1111-2222' }],
    })
    expect(isGaExistingCardMetadataChangeBlocked(base, edited)).toBe(false)
  })

  it('회사명이 바뀌면 true', () => {
    const base = draft()
    const edited = draft({ companyName: '다른생명' })
    expect(isGaExistingCardMetadataChangeBlocked(base, edited)).toBe(true)
  })
})

describe('applySuccessfulCardSaves', () => {
  it('성공한 카드만 baseline에 반영한다', () => {
    const base = draft()
    const edited = draft({
      contacts: [{ rowKey: 'r1', name: '수정', position: '', phone: '010-9999-8888' }],
    })
    const failed = draft({ cardKey: 'c2', companyName: '실패사' })
    const merged = applySuccessfulCardSaves(
      [base],
      [edited, failed],
      [
        { cardKey: 'c1', companyName: '테스트생명', ok: true },
        { cardKey: 'c2', companyName: '실패사', ok: false, message: 'err' },
      ],
    )
    expect(JSON.stringify(merged.baseline[0])).toBe(JSON.stringify(edited))
    expect(merged.drafts).toHaveLength(2)
  })

  it('삭제 성공 카드는 draft에서 제거한다', () => {
    const marked = draft({ markedForDeletion: true })
    const merged = applySuccessfulCardSaves(
      [marked],
      [marked],
      [{ cardKey: 'c1', companyName: '테스트생명', ok: true }],
    )
    expect(merged.drafts).toHaveLength(0)
    expect(merged.baseline).toHaveLength(0)
  })
})
