import { describe, expect, it } from 'vitest'
import type { CompanyDirectoryEntry } from '../domain/types'
import { groupCompanyDirectoryEntriesByMasterId } from './companyDirectoryViewGrouping'

function entry(id: number, contacts: CompanyDirectoryEntry['contacts']): CompanyDirectoryEntry {
  return {
    id,
    companyCode: `INS${id}`,
    category: 'LIFE',
    name: '삼성생명',
    customerCenter: '',
    systemPhone: '',
    incallNumber: '',
    visitInfo: '',
    contacts,
    general: null,
  }
}

describe('groupCompanyDirectoryEntriesByMasterId', () => {
  it('동일 company id 행은 담당자만 병합해 카드 1개로 만든다', () => {
    const rows = [
      entry(10, [{ id: 1, companyId: 10, name: '홍', position: '', phone: '010-1111-1111' }]),
      entry(10, [{ id: 2, companyId: 10, name: '김', position: '', phone: '010-2222-2222' }]),
    ]
    const grouped = groupCompanyDirectoryEntriesByMasterId(rows)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].contacts).toHaveLength(2)
  })

  it('서로 다른 company id는 별도 카드로 유지한다', () => {
    const rows = [
      entry(10, [{ id: 1, companyId: 10, name: '홍', position: '', phone: '010-1111-1111' }]),
      entry(11, [{ id: 2, companyId: 11, name: '김', position: '', phone: '010-2222-2222' }]),
    ]
    expect(groupCompanyDirectoryEntriesByMasterId(rows)).toHaveLength(2)
  })
})
