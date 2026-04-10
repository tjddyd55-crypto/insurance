import { Link } from 'react-router-dom'
import MainWorkspaceLayout from '../../../layouts/MainWorkspaceLayout'
import { useMediaQuery } from '../../../hooks/useMediaQuery'

export default function MemoRoutePage() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div className="memo-route-page">
        <MainWorkspaceLayout>
          <div className="p-4 space-y-3">
            <h1 className="text-lg font-bold">업무 영역</h1>
            <p className="text-sm text-[var(--text-muted)]">
              우측에서 메모를 사용합니다. 다른 화면으로 이동하려면 아래 링크를 사용하세요.
            </p>
            <Link to="/dashboard" className="text-blue-400 hover:underline">
              대시보드로 이동
            </Link>
          </div>
        </MainWorkspaceLayout>
      </div>
    )
  }

  return (
    <div className="memo-route-page memo-route-page--desktop">
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-bold">업무 영역</h1>
        <p className="text-sm text-[var(--text-muted)]">
          메모는 화면 우측 패널에서 항상 사용할 수 있습니다. 다른 화면으로 이동하려면 아래 링크를 사용하세요.
        </p>
        <Link to="/dashboard" className="text-blue-400 hover:underline">
          대시보드로 이동
        </Link>
      </div>
    </div>
  )
}
