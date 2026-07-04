import { isGaTenantAdminRole } from './rbacScope.js'
import { parseGaId } from './parseGaId.js'

/** GA_ADMIN · GA_STAFF · SUPER_ADMIN(ga 컨텍스트) — 공유 사용자 목록 조회 */
export function canAccessSharedAccountUserList({ requesterRole, requesterGaId }) {
  if (!isGaTenantAdminRole(requesterRole)) {
    return false
  }
  return parseGaId(requesterGaId) != null
}

/**
 * 스태프가 다른 사용자의 "공유 계정관리"에 접근할 수 있는지 판정하는 순수 함수.
 *
 * 규칙(모두 만족해야 허용):
 *   1. 요청자가 GA 스태프 이상 역할(SUPER_ADMIN · GA_ADMIN · GA_STAFF)이다.
 *   2. 요청자와 대상이 같은 tenant(ga_id)에 속한다.
 *   3. 대상 사용자의 계정관리 공유 상태가 ON 이다.
 */
export function canAccessSharedAccountManagement({
  requesterRole,
  requesterGaId,
  targetGaId,
  targetShareEnabled,
}) {
  if (!isGaTenantAdminRole(requesterRole)) {
    return false
  }
  const requesterGa = parseGaId(requesterGaId)
  const targetGa = parseGaId(targetGaId)
  if (requesterGa == null || targetGa == null) {
    return false
  }
  if (requesterGa !== targetGa) {
    return false
  }
  return targetShareEnabled === true
}
