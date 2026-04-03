import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useInsurerNewsAdminSession } from '../InsurerNewsAdminContext'

export function InsurerNewsAdminLoginPage() {
  const { session, login } = useInsurerNewsAdminSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to="/portal/insurer-news/dashboard" replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = login(username.trim(), password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/portal/insurer-news/dashboard', { replace: true })
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <section className="card auth-card" style={{ maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>원수사 소식지 관리</h1>
        <p className="insurer-news-muted">본 페이지는 GA 소속 원수사 관리자 전용입니다.</p>
        <form className="auth-form insurer-news-page" onSubmit={onSubmit}>
          <label className="field">
            <span className="field__label">아이디</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="admin-form-input"
            />
          </label>
          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="admin-form-input"
            />
          </label>
          {error ? <p className="status status--error">{error}</p> : null}
          <button type="submit" className="button button--primary button--full" disabled={busy}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>
        <p className="insurer-news-muted" style={{ fontSize: 12 }}>
          데모: <code style={{ fontSize: 11 }}>db_admin_yj</code> / <code>demo1234</code> (DB손해 · YJASSET)
        </p>
      </section>
    </main>
  )
}
