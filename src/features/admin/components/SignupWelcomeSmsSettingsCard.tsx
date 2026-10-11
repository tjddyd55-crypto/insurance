import { useEffect, useState } from 'react'
import { FormButton } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import {
  fetchSignupWelcomeSmsSetting,
  resetSignupWelcomeSmsSetting,
  saveSignupWelcomeSmsSetting,
  type SignupWelcomeSmsSetting,
} from '../api/signupWelcomeSmsAdminApi'

type Props = {
  token: string
}

function formatUpdatedAt(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR')
}

export default function SignupWelcomeSmsSettingsCard({ token }: Props) {
  const [setting, setSetting] = useState<SignupWelcomeSmsSetting | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const applySetting = (next: SignupWelcomeSmsSetting) => {
    setSetting(next)
    setDraft(next.message)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchSignupWelcomeSmsSetting(token)
      .then((next) => {
        if (!cancelled) applySetting(next)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '가입 안내 문자 설정을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const save = async () => {
    if (!draft.trim() || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const next = await saveSignupWelcomeSmsSetting(token, draft)
      applySetting(next)
      setMessage('가입 안내 문자 내용이 저장되었습니다. 다음 신규 가입부터 적용됩니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const next = await resetSignupWelcomeSmsSetting(token)
      applySetting(next)
      setMessage('기본 가입 안내 문자로 복원되었습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '기본 문구 복원에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card auth-card" style={{ maxWidth: 'none', margin: 0 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>신규 가입 안내 문자</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
            회원가입 완료 후 가입한 휴대폰 번호로 1회 발송되는 안내 문자입니다.
          </p>
        </div>

        <StatusMessage message={error} tone="error" className="m-0" />
        <StatusMessage message={message} tone="success" className="m-0" />

        <div style={{ display: 'grid', gap: 6 }}>
          <strong>현재 발송 문구</strong>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              padding: 12,
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--surface-subtle)',
              lineHeight: 1.6,
            }}
          >
            {loading ? '불러오는 중...' : setting?.message || '—'}
          </div>
          {!loading && setting ? (
            <small style={{ color: 'var(--text-secondary)' }}>
              현재 상태: {setting.source === 'custom' ? '관리자 설정 문구' : '기본 문구'}
              {setting.updatedAt ? ` · 마지막 수정 ${formatUpdatedAt(setting.updatedAt)}` : ''}
            </small>
          ) : null}
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <strong>문자 내용 수정</strong>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={loading || saving}
            maxLength={2000}
            rows={7}
            style={{
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
              padding: 12,
              border: '1px solid var(--border)',
              borderRadius: 10,
              font: 'inherit',
              lineHeight: 1.6,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
            aria-label="신규 가입 안내 문자 내용"
          />
          <small style={{ color: 'var(--text-secondary)' }}>
            {draft.length.toLocaleString()} / 2,000자 · 저장 후 다음 신규 가입부터 바로 적용됩니다.
          </small>
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FormButton
            htmlType="button"
            onClick={() => void save()}
            disabled={loading || saving || !draft.trim() || draft === setting?.message}
          >
            {saving ? '저장 중...' : '문구 저장'}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            onClick={() => setting && setDraft(setting.message)}
            disabled={loading || saving || !setting || draft === setting.message}
          >
            수정 취소
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            onClick={() => void reset()}
            disabled={loading || saving || setting?.source === 'default'}
          >
            기본 문구로 복원
          </FormButton>
        </div>

        {setting ? (
          <details>
            <summary style={{ cursor: 'pointer' }}>기본 문구 확인</summary>
            <div
              style={{
                marginTop: 8,
                whiteSpace: 'pre-wrap',
                padding: 12,
                border: '1px solid var(--border)',
                borderRadius: 10,
                lineHeight: 1.6,
              }}
            >
              {setting.defaultMessage}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}
