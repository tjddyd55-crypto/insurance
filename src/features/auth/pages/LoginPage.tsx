import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { login as loginApi } from '../authApi'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()
  const flash = (location.state ?? {}) as { passwordReset?: boolean; accountReset?: boolean }

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    let cancelled = false
    const webVersion =
      typeof __INSURANCE_WEB_APP_VERSION__ === 'string'
        ? __INSURANCE_WEB_APP_VERSION__
        : ''

    void (async () => {
      if (typeof window !== 'undefined' && window.electronAPI?.getVersion) {
        try {
          const v = await window.electronAPI.getVersion()
          if (!cancelled) {
            setVersion(v)
          }
          return
        } catch {
          /* fall through to web bundle version */
        }
      }
      if (!cancelled) {
        setVersion(webVersion)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

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

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>로그인</h1>
        {flash.passwordReset ? (
          <p className="auth-notice" role="status">
            비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.
          </p>
        ) : null}
        {flash.accountReset ? (
          <p className="auth-notice" role="status">
            계정이 초기화되었습니다. 서비스 이용이 필요하면 소속 GA에 새 계정 발급을 요청해 주세요.
          </p>
        ) : null}

        <form className="auth-form" style={{ marginTop: '1rem' }} onSubmit={(e) => void handleLogin(e)}>
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
          <Link to="/register" className="switch-text__action">
            회원가입
          </Link>
        </div>

        <div className="switch-text">
          비밀번호를 잊으셨나요?
          <Link to="/password-reset" className="switch-text__action">
            비밀번호 재설정
          </Link>
        </div>
      </section>

      {version ? (
        <div className="auth-page__version-footer" aria-hidden="true">
          {'\uBC84\uC804: '}
          {version}
        </div>
      ) : null}
    </main>
  )
}
