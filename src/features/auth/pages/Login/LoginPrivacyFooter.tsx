import { Link } from 'react-router-dom'

/** 로그인 화면 하단 법적 고지 링크 (인증 불필요 공개 경로) */
export default function LoginPrivacyFooter() {
  return (
    <nav className="auth-page__privacy-footer" aria-label="법적 고지">
      <Link to="/privacy" className="auth-page__privacy-link">
        개인정보처리방침
      </Link>
      <span className="auth-page__privacy-sep" aria-hidden="true">
        ·
      </span>
      <Link to="/account-deletion" className="auth-page__privacy-link">
        계정 삭제 요청
      </Link>
    </nav>
  )
}
