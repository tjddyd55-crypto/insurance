import { describe, expect, it } from 'vitest'

import { buildPersonalContactsDirectoryView } from './personalContactsDirectoryView'
import type { InsuranceContact } from '../domain/types'
import type { CompanyDirectoryEntry } from '../../company-registry/domain/types'

const directoryRow: CompanyDirectoryEntry = {
  id: 10,
  companyCode: 'INS_SEED_011',
  category: 'LIFE',
  name: '삼성생명',
  customerCenter: '1588',
  systemPhone: '',
  incallNumber: '',
  visitInfo: '',
  contacts: [{ id: 99, companyId: 10, name: 'GA담당', position: '팀장', phone: '0211112222' }],
  general: null,
}

const personal: InsuranceContact[] = [
  {
    id: 'pc-1',
    category: 'LIFE',
    companyName: '삼성생명',
    managerName: '홍길동',
    position: '매니저',
    phoneNumber: '01012345678',
    createdAt: '',
    updatedAt: '',
  },
]

describe('buildPersonalContactsDirectoryView', () => {
  it('GA 디렉터리 담당자를 제거하고 개인 연락처만 표시한다', () => {
    const rows = buildPersonalContactsDirectoryView([directoryRow], personal, 'LIFE')
    expect(rows[0].contacts).toHaveLength(1)
    expect(rows[0].contacts[0].name).toBe('홍길동')
  })
})
