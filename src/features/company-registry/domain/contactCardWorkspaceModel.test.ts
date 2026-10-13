import { describe, expect, it } from 'vitest'
import {
  applyNewCardCategoryChange,
  findDuplicateCard,
  cardDraftMatchesSearch,
  emptyContactRow,
  filterVisibleEditDrafts,
  prunePinnedEditCardKeys,
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

describe('filterVisibleEditDrafts', () => {
  it('종류를 바꾼 신규 카드는 pinned이면 현재 탭에 계속 표시된다', () => {
    const lifeCard = sampleDraft({ cardKey: 'new-1', isNew: true, category: 'NON_LIFE' })
    const pinned = new Set(['new-1'])
    const visible = filterVisibleEditDrafts([lifeCard], 'LIFE', '', pinned)
    expect(visible).toHaveLength(1)
    expect(visible[0].cardKey).toBe('new-1')
  })

  it('pinned 없으면 다른 종류 카드는 현재 탭에서 숨긴다', () => {
    const card = sampleDraft({ cardKey: 'x', category: 'NON_LIFE' })
    expect(filterVisibleEditDrafts([card], 'LIFE', '', new Set())).toHaveLength(0)
  })
})

describe('prunePinnedEditCardKeys', () => {
  it('탭 전환 후 종류가 맞으면 pin을 해제한다', () => {
    const card = sampleDraft({ cardKey: 'new-1', category: 'NON_LIFE' })
    const pruned = prunePinnedEditCardKeys(new Set(['new-1']), [card], 'NON_LIFE')
    expect(pruned.size).toBe(0)
  })
})

describe('applyNewCardCategoryChange', () => {
  it('담당자는 유지하고 회사 선택만 초기화한다', () => {
    const draft = sampleDraft({
      isNew: true,
      companyCode: 'INS1',
      companyName: '테스트',
      contacts: [{ rowKey: 'r1', name: '홍길동', position: '팀장', phone: '010-1111-2222' }],
    })
    const next = applyNewCardCategoryChange(draft, 'NON_LIFE')
    expect(next.category).toBe('NON_LIFE')
    expect(next.companyCode).toBe('')
    expect(next.contacts[0].name).toBe('홍길동')
  })

  it('기존 저장 카드는 종류 변경을 적용하지 않는다', () => {
    const draft = sampleDraft({ isNew: false, category: 'LIFE' })
    expect(applyNewCardCategoryChange(draft, 'NON_LIFE').category).toBe('LIFE')
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
