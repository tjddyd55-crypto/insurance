import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import StorageWorkspace from '../components/StorageWorkspace'

export default function MyStoragePage() {
  const { user, token } = useAuth()

  if (!token?.trim()) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'USER' && user?.role !== 'GA_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  return (
    <StorageWorkspace
      token={token}
      customerId={null}
      title="내 저장공간"
      subtitle="폴더와 파일은 최신순으로 정렬됩니다."
    />
  )
}
