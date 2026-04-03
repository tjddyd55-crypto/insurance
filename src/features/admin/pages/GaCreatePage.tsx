import { type FormEvent, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { createGaCompany } from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

export default function GaCreatePage() {
  const { user, token } = useAuth()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>GA 생성</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
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
      await createGaCompany(token, { name, code })
      window.alert('GA를 생성(또는 동일 코드로 이름을 갱신)했습니다.')
      setName('')
      setCode('')
      setStatusText('저장되었습니다. 같은 화면에서 계속 추가할 수 있습니다.')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>GA 생성</h1>
        <p>{statusText || 'GA 이름과 코드를 등록합니다. 코드는 영문 대문자·숫자·밑줄(2~32자)만 사용할 수 있습니다.'}</p>
      </header>

      <section className="card auth-card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="field">
            <span className="field__label">GA 이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="예: 영진에셋" />
          </label>
          <label className="field">
            <span className="field__label">GA 코드</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="예: YJASSET"
              autoComplete="off"
            />
          </label>
          <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '처리 중…' : '생성'}
          </button>
        </form>
      </section>
    </main>
  )
}
