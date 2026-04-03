import { type FormEvent, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { submitFeatureRequest } from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

export default function FeatureRequestPage() {
  const { token } = useAuth()
  const [content, setContent] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      setStatusText('로그인이 필요합니다.')
      return
    }
    const trimmed = content.trim()
    if (!trimmed) {
      setStatusText('내용을 입력해 주세요.')
      return
    }
    setStatusText('')
    setIsSubmitting(true)
    try {
      await submitFeatureRequest(token, trimmed)
      setContent('')
      setStatusText('요청이 접수되었습니다. 검토 후 반영 여부는 별도 안내가 어려울 수 있습니다.')
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : '전송에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>추가 기능 요청하기</h1>
        <p>
          {statusText ||
            '필요하신 기능이나 개선 사항을 남겨 주세요. 소속 GA·계정 정보와 함께 저장됩니다.'}
        </p>
      </header>

      <section className="card auth-card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <form className="auth-form" onSubmit={(ev) => void handleSubmit(ev)}>
          <label className="field">
            <span className="field__label">내용</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
              maxLength={8000}
              placeholder="예: OO 화면에서 검색 필터를 추가해 주세요."
              style={{ minHeight: 160, resize: 'vertical' }}
            />
          </label>
          <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '전송 중…' : '전송하기'}
          </button>
        </form>
      </section>
    </main>
  )
}
