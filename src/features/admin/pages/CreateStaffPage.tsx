import { type FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  createDelegateUser,
  listGaCompanies,
  type GaCompanyRow,
  type GaDelegateRole,
} from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

export default function CreateStaffPage() {
  const { user, token } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [gaId, setGaId] = useState<number | ''>('')
  const [delegateRole, setDelegateRole] = useState<GaDelegateRole>('GA_ADMIN')
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [statusText, setStatusText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    let c = false
    ;(async () => {
      try {
        const list = await listGaCompanies(token)
        if (!c) {
          setGaList(list)
          if (list.length === 1) {
            setGaId(list[0].id)
          }
        }
      } catch {
        if (!c) {
          setStatusText('GA 목록을 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      c = true
    }
  }, [token, user?.role])

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>담당자 생성</h1>
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
    if (gaId === '' || !Number.isInteger(Number(gaId))) {
      setStatusText('소속 GA를 선택하세요.')
      return
    }

    setStatusText('')
    setIsSubmitting(true)
    try {
      await createDelegateUser(token, {
        username,
        password,
        name,
        gaId: Number(gaId),
        role: delegateRole,
      })
      window.alert(`담당자 계정을 생성했습니다. (${delegateRole})`)
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
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>담당자 생성</h1>
        <p>
          {statusText ||
            '소속 GA의 담당자(GA_ADMIN 또는 GA_STAFF) 계정을 만듭니다. 아이디는 로그인에 사용됩니다.'}
        </p>
      </header>

      <section className="card auth-card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
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
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">역할</span>
            <select
              value={delegateRole}
              onChange={(e) => setDelegateRole(e.target.value as GaDelegateRole)}
              required
            >
              <option value="GA_ADMIN">GA_ADMIN (관리자)</option>
              <option value="GA_STAFF">GA_STAFF (스태프)</option>
            </select>
          </label>
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
      </section>
    </main>
  )
}
