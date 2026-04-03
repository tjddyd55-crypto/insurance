import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { gaLabel } from '../../consent/admin/consentAdminMeta'
import { useAuth } from '../AuthProvider'
import { listGaCompanies, login as loginApi, register as registerApi, type GaCompanyRow } from '../authApi'

export function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaId, setGaId] = useState<number | ''>('')
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listGaCompanies()
        if (!cancelled) {
          setGaList(list)
          if (list.length === 1) {
            setGaId(list[0].id)
          }
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('GA 목록을 불러오지 못했습니다. 네트워크를 확인해 주세요.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    if (gaId === '' || !Number.isInteger(Number(gaId))) {
      setErrorMessage('소속 GA를 선택하세요.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    setIsSubmitting(true)
    try {
      await registerApi(username, password, Number(gaId))
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
        <p className="auth-description">아이디·비밀번호와 소속 GA를 등록합니다.</p>

        <form className="auth-form" onSubmit={(e) => void handleSignup(e)}>
          <label className="field">
            <span className="field__label">소속 GA</span>
            <select
              value={gaId === '' ? '' : String(gaId)}
              onChange={(e) => setGaId(e.target.value === '' ? '' : Number(e.target.value))}
              required
            >
              <option value="">선택하세요</option>
              {gaList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code}) · {gaLabel(g.id)}
                </option>
              ))}
            </select>
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
