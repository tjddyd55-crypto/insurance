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

  it('디렉터리에 없는 동일 보험회사 담당자 N명은 조회 카드 1개로 묶는다', () => {
    const fourManagers: InsuranceContact[] = [
      {
        id: 'pc-1',
        category: 'NON_LIFE',
        companyName: '농협손해보험',
        managerName: '담당1',
        position: '팀장',
        phoneNumber: '01011111111',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'pc-2',
        category: 'NON_LIFE',
        companyName: '농협손해보험',
        managerName: '담당2',
        position: '매니저',
        phoneNumber: '01022222222',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'pc-3',
        category: 'NON_LIFE',
        companyName: '농협손해보험',
        managerName: '담당3',
        position: '매니저',
        phoneNumber: '01033333333',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'pc-4',
        category: 'NON_LIFE',
        companyName: '농협손해보험',
        managerName: '담당4',
        position: '매니저',
        phoneNumber: '01044444444',
        createdAt: '',
        updatedAt: '',
      },
    ]
    const rows = buildPersonalContactsDirectoryView([], fourManagers, 'NON_LIFE')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('농협손해보험')
    expect(rows[0].contacts).toHaveLength(4)
  })
})
