import { describe, expect, it } from 'vitest'
import {
  findDuplicateCard,
  cardDraftMatchesSearch,
  emptyContactRow,
  type ContactCompanyCardDraft,
} from './contactCardWorkspaceModel'

function sampleDraft(overrides: Partial<ContactCompanyCardDraft> = {}): ContactCompanyCardDraft {
  return {
    cardKey: 'card-1',
    category: 'LIFE',
    companyCode: 'INS001',
    companyId: 1,
    companyName: '삼성생명',
    customerCenter: '',
    systemPhone: '',
    incallNumber: '',
    visitInfo: '',
    contacts: [emptyContactRow()],
    isNew: false,
    markedForDeletion: false,
    ...overrides,
  }
}

describe('findDuplicateCard', () => {
  it('같은 종류·코드의 카드를 찾는다', () => {
    const drafts = [sampleDraft(), sampleDraft({ cardKey: 'card-2', companyCode: 'INS002', companyName: '한화' })]
    const dup = findDuplicateCard(drafts, 'LIFE', 'INS001', 'card-new')
    expect(dup?.companyName).toBe('삼성생명')
  })

  it('삭제 예정 카드는 중복으로 보지 않는다', () => {
    const drafts = [sampleDraft({ markedForDeletion: true })]
    expect(findDuplicateCard(drafts, 'LIFE', 'INS001')).toBeUndefined()
  })
})

describe('cardDraftMatchesSearch', () => {
  it('담당자 전화번호로 검색한다', () => {
    const draft = sampleDraft({
      contacts: [{ rowKey: 'r1', name: '김', position: '', phone: '010-1234-5678' }],
    })
    expect(cardDraftMatchesSearch(draft, '1234')).toBe(true)
    expect(cardDraftMatchesSearch(draft, '9999')).toBe(false)
  })
})
