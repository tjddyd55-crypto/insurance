import { Navigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'

/**
 * 고객앱 내정보 수정은 CRM 고객 원장을 오염시킬 수 있어 비활성화한다.
 * 직접 URL(`/customer-app/profile`) 접근 시 홈으로 redirect 한다.
 */
export default function CustomerAppProfilePage() {
  return (
    <>
      <div className="customer-app-profile-page">
        <StatusMessage message="고객 정보 수정 기능은 현재 사용할 수 없습니다." tone="error" />
        <p className="customer-app-profile__danger-help">청구/문의는 홈 또는 청구 화면에서 이용할 수 있습니다.</p>
      </div>
      <Navigate to="/customer-app/home" replace />
    </>
  )
}
