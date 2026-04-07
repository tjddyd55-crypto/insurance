import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import { createManagerNewsletter, resolveInsurerManagerPublishContext } from '../services/insurerNews.service'

export function InsurerManagerNewsUploadPage() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const [error, setError] = useState('')
  const [context, setContext] = useState<{
    gaCode: string
    insurerCode: string
    insurerName: string
    insurerSlug: string
  } | null>(null)

  useEffect(() => {
    if (!token?.trim() || !gaCode || companyId == null) {
      return
    }
    let cancelled = false
    ;(async () => {
      const resolved = await resolveInsurerManagerPublishContext(token, gaCode, companyId)
      if (cancelled) {
        return
      }
      if ('error' in resolved) {
        setError(resolved.error)
        setContext(null)
      } else {
        setError('')
        setContext(resolved)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, gaCode, companyId])

  if (!gaCode || companyId == null) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty">원수사 담당자 계정으로 로그인한 후 이용할 수 있습니다.</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty">{error}</div>
      </main>
    )
  }

  if (!context) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>원수사 소식지 업로드</h1>
        <p className="insurer-news-muted">등록된 내용은 GA 소속 사용자에게 공개될 수 있습니다.</p>
      </header>
      <InsurerNewsForm
        mode="create"
        initial={null}
        context={context}
        authToken={token}
        onCancel={() => navigate('/insurer/news')}
        onSubmit={async (draft) => {
          await createManagerNewsletter(token!, draft)
          navigate('/insurer/news')
        }}
      />
    </main>
  )
}
