import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { login as loginApi, register as registerApi } from '../authApi'

export function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    const code = inviteCode.trim()
    if (!code) {
      setErrorMessage('초대 코드를 입력하세요.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    setIsSubmitting(true)
    try {
      await registerApi(username, password, code)
      const session = await loginApi(username, password)
      login(session)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '회원가입에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>회원가입</h1>
        <p className="auth-description">
          소속 GA에서 안내받은 초대 코드와 아이디·비밀번호를 등록합니다.
        </p>

        <form className="auth-form" onSubmit={(e) => void handleSignup(e)}>
          <label className="field">
            <span className="field__label">초대 코드 (invite_code)</span>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              placeholder="예: YJASSET"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">아이디</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">비밀번호 확인</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}

          <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '가입 중…' : '가입'}
          </button>
        </form>

        <div className="switch-text">
          이미 계정이 있나요?
          <Link to="/login" className="switch-text__action">
            로그인
          </Link>
        </div>

        <p className="auth-legal-links">
          <Link to="/privacy" className="auth-legal-links__a" target="_blank" rel="noopener noreferrer">
            개인정보처리방침
          </Link>
        </p>
      </section>
    </main>
  )
}
