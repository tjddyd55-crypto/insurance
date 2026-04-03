import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { login as loginApi, register as registerApi } from '../authApi'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, login } = useAuth()

  const [showSignup, setShowSignup] = useState(() => searchParams.get('signup') === '1')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (searchParams.get('signup') === '1') {
      setShowSignup(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    setErrorMessage('')
  }, [showSignup])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const session = await loginApi(username, password)
      login(session)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await registerApi(username, password)
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
        {!showSignup ? (
          <>
            <h1>로그인</h1>
            <p className="auth-description">아이디와 비밀번호로 신청서를 관리합니다.</p>

            <form className="auth-form" onSubmit={(e) => void handleLogin(e)}>
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
                  autoComplete="current-password"
                  required
                />
              </label>

              {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}

              <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className="switch-text">
              계정이 없으신가요?
              <button type="button" className="switch-text__action" onClick={() => setShowSignup(true)}>
                회원가입
              </button>
            </div>

            <p className="auth-legal-links">
              <Link to="/privacy" className="auth-legal-links__a" target="_blank" rel="noopener noreferrer">
                개인정보처리방침
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1>회원가입</h1>
            <p className="auth-description">아이디/비밀번호만 등록하면 바로 시작할 수 있습니다.</p>

            <form className="auth-form" onSubmit={(e) => void handleSignup(e)}>
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

              {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}

              <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '가입 중…' : '가입'}
              </button>
            </form>

            <div className="switch-text">
              이미 계정이 있나요?
              <button type="button" className="switch-text__action" onClick={() => setShowSignup(false)}>
                로그인
              </button>
            </div>

            <p className="auth-legal-links">
              <Link to="/privacy" className="auth-legal-links__a" target="_blank" rel="noopener noreferrer">
                개인정보처리방침
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  )
}
