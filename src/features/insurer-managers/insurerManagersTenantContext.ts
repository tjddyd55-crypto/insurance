import type { AuthUser } from '../auth/authApi'

/** 원수사 담당자 관리 — GA 테넌트(회사 디렉터리·insurer_managers API) 세션 여부 */
export function hasInsurerManagersGaTenant(user: Pick<AuthUser, 'gaId' | 'gaCode'> | null | undefined): boolean {
  const gaId = user?.gaId
  if (gaId == null) {
    return false
  }
  const n = Number(gaId)
  return Number.isInteger(n) && n >= 1
}
