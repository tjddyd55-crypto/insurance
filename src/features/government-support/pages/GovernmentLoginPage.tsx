import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FormButton, FormInput } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { login as loginApi } from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import '../government-support.css'

export default function GovernmentLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/government/workspace" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await loginApi(username.trim(), password)
      if (res.authKind === 'BOARD_WRITER') {
        setError('정부지원 CRM 계정이 아닙니다.')
        return
      }
      login({ token: res.token, user: res.user })
      navigate('/government/workspace', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page government-page government-page--gate">
      <h1 className="government-page__title">정부지원 CRM 로그인</h1>
      <p className="government-page__muted">government-support 전용 진입점입니다.</p>
      <form onSubmit={onSubmit} style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
        <FormInput label="아이디" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <FormInput
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error ? <p style={{ color: '#ef4444', margin: 0 }}>{error}</p> : null}
        <FormButton type="submit" disabled={submitting}>
          로그인
        </FormButton>
      </form>
      <p className="government-page__muted" style={{ marginTop: '1rem' }}>
        <Link to="/government/signup">회원가입</Link>
        {' · '}
        <Link to="/government/join">가입 코드로 가입</Link>
      </p>
    </main>
  )
}
