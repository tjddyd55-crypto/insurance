import { SignupWelcomeSmsSettingsPanel } from '../components/SignupWelcomeSmsSettingsPanel'
import { useAuth } from '../../auth/AuthProvider'

/**
 * SUPER_ADMIN — 자동 발송 문자·알림 문구 설정 (현재: 신규 가입 안내 문자).
 */
export default function AdminMessageSettingsPage() {
  const { user } = useAuth()

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>문자 / 알림 설정</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-message-settings">
      <header className="page-header">
        <h1>문자 / 알림 설정</h1>
        <p>사용자 가입 및 운영 과정에서 자동 발송되는 안내 메시지를 관리합니다.</p>
      </header>
      <SignupWelcomeSmsSettingsPanel />
    </main>
  )
}
