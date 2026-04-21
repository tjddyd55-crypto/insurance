import { useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'

/**
 * 모바일 전용 메모 진입 FAB(Floating Action Button).
 *
 * ## 위치 정책
 *
 * - 가로: 화면 우측 가장자리(오른쪽 16px 여백).
 * - 세로: 화면 하단에서 1/3 지점 — CSS 변수 `--memo-fab-bottom` 으로 관리.
 *         나중에 위치 정책이 바뀌어도 CSS 한 줄만 고치면 된다.
 *
 * ## 왜 FAB 단일 진입인가
 *
 *  - 메뉴/드로어에 메모 항목을 두면 "햄버거 → 스크롤 → 탭" 이라는 3 스텝이 필요.
 *  - 메모는 "지금 이 화면에서 떠오른 생각을 즉시 적는다" 가 핵심 UX 라 상시 한 번
 *    터치로 닿아야 한다. FAB 는 이 요구에 가장 맞는 UI 패턴.
 *
 * ## 동작
 *
 *  - 클릭 시 `/memo` 로 네비게이션.
 *  - `/memo` 경로에서는 자기 자신으로 이동할 의미가 없으므로 렌더하지 않는다.
 *  - 메뉴 오버레이는 띄우지 않는다(단일 책임).
 *
 * ## 사용
 *
 * 모바일 최상위 레이아웃(`AppWorkspaceLayoutMobileShell`) 최상단에 한 번만 렌더.
 * 개별 페이지마다 렌더하면 페이지 전환 시 깜빡임·중복 렌더의 원인이 된다.
 */
export function MemoMobileFab() {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/memo' || location.pathname.startsWith('/memo/')) {
    return null
  }

  return (
    <FormButton
      htmlType="button"
      aria-label="메모 열기"
      className="memo-mobile-fab"
      onClick={() => navigate('/memo')}
    >
      메모
    </FormButton>
  )
}

export default MemoMobileFab
