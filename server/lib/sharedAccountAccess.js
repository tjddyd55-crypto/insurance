import { isGaTenantAdminRole } from './rbacScope.js'
import { parseGaId } from './parseGaId.js'

/**
 * 스태프가 다른 사용자의 "공유 계정관리"에 접근할 수 있는지 판정하는 순수 함수.
 *
 * 규칙(모두 만족해야 허용):
 *   1. 요청자가 GA 스태프 이상 역할(SUPER_ADMIN · GA_ADMIN · GA_STAFF)이다.
 *   2. 요청자와 대상이 같은 tenant(ga_id)에 속한다.
 *   3. 대상 사용자의 계정관리 공유 상태가 ON 이다.
 *
 * SUPER_ADMIN 정책(A안): 메뉴에는 노출하지 않지만(gaTenantMenu 는 GA_ADMIN·GA_STAFF 만),
 * GA 컨텍스트(ga_id)가 있는 경우 운영 점검용으로 직접 URL/API 접근은 허용한다.
 * GA 컨텍스트가 없으면(대부분의 플랫폼 SUPER_ADMIN) 아래 parseGaId 가드에서 걸러진다.
 *
 * DB/네트워크에 의존하지 않으므로 단독으로 단위 테스트할 수 있다.
 *
 * @param {object} input
 * @param {unknown} input.requesterRole
 * @param {unknown} input.requesterGaId
 * @param {unknown} input.targetGaId
 * @param {unknown} input.targetShareEnabled
 * @returns {boolean}
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
