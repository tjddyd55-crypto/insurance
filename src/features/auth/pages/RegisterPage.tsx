import { Navigate } from 'react-router-dom'

/** 구 URL `/register` → 로그인 화면의 회원가입 토글 */
export function RegisterPage() {
  return <Navigate to="/login?signup=1" replace />
}
