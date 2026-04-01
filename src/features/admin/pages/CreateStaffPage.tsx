import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { createStaffAccount } from '../../auth/authApi'

export default function CreateStaffPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user?.role !== 'super_admin') {
    return (
      <main className="page">
        <header className="page-header">
          <h1>담당자 생성</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
        <button className="button button--full" type="button" onClick={() => navigate('/dashboard')}>
          메뉴로
        </button>
      </main>
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token?.trim()) {
      setStatusText('로그인이 필요합니다.')
      return
    }

    setStatusText('')
    setIsSubmitting(true)
    try {
      await createStaffAccount(token, { username, password, name })
      window.alert('담당자(staff) 계정을 생성했습니다.')
      setUsername('')
      setPassword('')
      setName('')
      setStatusText('생성 완료. 같은 페이지에서 추가로 등록할 수 있습니다.')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>담당자 생성</h1>
        <p>{statusText || 'staff 역할 계정을 만듭니다. 아이디는 로그인에 사용됩니다.'}</p>
      </header>

      <section className="card auth-card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="field">
            <span className="field__label">아이디</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">이름 (표시용, 선택)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="예: 홍길동"
            />
          </label>

          <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '처리 중…' : '생성'}
          </button>
        </form>

        <button
          className="button button--secondary button--full"
          type="button"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard')}
        >
          메뉴로
        </button>
      </section>
    </main>
  )
}
