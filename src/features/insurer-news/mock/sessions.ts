import type { InsurerManagerAccount } from '../types'

/** 데모 원수사 관리자 — 로그인은 username / password 만 (이메일 없음) */
export const MOCK_INSURER_MANAGER_ACCOUNTS: InsurerManagerAccount[] = [
  {
    id: 'ima-yj-db',
    gaCode: 'YJASSET',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    username: 'db_admin_yj',
    passwordPlain: 'demo1234',
    status: 'ACTIVE',
  },
  {
    id: 'ima-yj-hd',
    gaCode: 'YJASSET',
    insurerCode: 'HD',
    insurerName: '현대해상',
    username: 'hyundai_admin_yj',
    passwordPlain: 'demo1234',
    status: 'ACTIVE',
  },
  {
    id: 'ima-other-db',
    gaCode: 'OTHER01',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    username: 'db_admin_other',
    passwordPlain: 'demo1234',
    status: 'ACTIVE',
  },
]

export function mockFindInsurerManager(username: string, password: string): InsurerManagerAccount | null {
  const u = username.trim()
  const found = MOCK_INSURER_MANAGER_ACCOUNTS.find((a) => a.username === u && a.passwordPlain === password)
  if (!found || found.status !== 'ACTIVE') {
    return null
  }
  return found
}
