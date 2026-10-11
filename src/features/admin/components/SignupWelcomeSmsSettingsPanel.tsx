import { useCallback, useEffect, useState } from 'react'
import { StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormTextarea } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchSignupWelcomeSmsSettings,
  resetSignupWelcomeSmsSettings,
  saveSignupWelcomeSmsSettings,
  type SignupWelcomeSmsSettings,
} from '../api/signupWelcomeSmsAdminApi'

const MAX_LEN = 2000

function formatSettingsUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function SignupWelcomeSmsSettingsPanel() {
  const { token, user } = useAuth()
  const [settings, setSettings] = useState<SignupWelcomeSmsSettings | null>(null)
  const [draft, setDraft] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDefaultPreview, setShowDefaultPreview] = useState(false)

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setLoadError('')
    setLoading(true)
    try {
      const data = await fetchSignupWelcomeSmsSettings(token)
      setSettings(data)
      setDraft(data.message)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '가입 안내 문자 설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    if (!token?.trim()) return
    setActionError('')
    setSuccessMessage('')
    const text = draft
    if (!text.trim()) {
      setActionError('문자 내용을 입력해 주세요.')
      return
    }
    if (text.length > MAX_LEN) {
      setActionError(`문자 내용은 ${MAX_LEN}자 이하로 입력해 주세요.`)
      return
    }
    setSaving(true)
    try {
      const data = await saveSignupWelcomeSmsSettings(token, text)
      setSettings(data)
      setDraft(data.message)
      setSuccessMessage('가입 안내 문자 내용이 저장되었습니다. 다음 신규 가입부터 적용됩니다.')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const onReset = async () => {
    if (!token?.trim()) return
    setActionError('')
    setSuccessMessage('')
    setSaving(true)
    try {
      const data = await resetSignupWelcomeSmsSettings(token)
      setSettings(data)
      setDraft(data.message)
      setSuccessMessage('기본 가입 안내 문자로 복원되었습니다.')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '복원에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const onCancelEdit = () => {
    setActionError('')
    setSuccessMessage('')
    if (settings) {
      setDraft(settings.message)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return null
  }

  const sourceLabel = settings?.source === 'custom' ? '관리자 설정 문구' : '기본 문구'

  return (
    <section className="card auth-card admin-signup-welcome-sms" aria-labelledby="signup-welcome-sms-title">
      <header className="admin-signup-welcome-sms__header">
        <h2 id="signup-welcome-sms-title">신규 가입 안내 문자</h2>
        <p className="admin-signup-welcome-sms__desc">
          회원가입 완료 후 가입한 휴대폰 번호로 1회 발송되는 안내 문자입니다.
        </p>
      </header>

      <StatusMessage message={loadError} tone="error" className="m-0" />
      <StatusMessage message={actionError} tone="error" className="m-0" />
      <StatusMessage message={successMessage} className="m-0" />

      <FieldWrapper label="현재 발송 문구" className="admin-modal-field">
        <pre className="admin-signup-welcome-sms__readonly" aria-readonly="true">
          {loading ? '불러오는 중…' : settings?.message ?? '—'}
        </pre>
      </FieldWrapper>

      <dl className="admin-signup-welcome-sms__meta">
        <div>
          <dt>현재 상태</dt>
          <dd>{loading ? '—' : sourceLabel}</dd>
        </div>
        <div>
          <dt>마지막 수정일</dt>
          <dd>{formatSettingsUpdatedAt(settings?.updatedAt ?? null)}</dd>
        </div>
        <div>
          <dt>마지막 수정자</dt>
          <dd>{settings?.updatedByUserId ?? '—'}</dd>
        </div>
      </dl>

      <FieldWrapper label="문자 내용 수정" className="admin-modal-field">
        <FormTextarea
          className="admin-form-input admin-signup-welcome-sms__textarea"
          value={draft}
          onChange={(e) => {
            setSuccessMessage('')
            setActionError('')
            setDraft(e.target.value)
          }}
          rows={8}
          maxLength={MAX_LEN}
          disabled={loading || saving}
        />
        <p className="admin-signup-welcome-sms__counter">{draft.length} / {MAX_LEN}자</p>
      </FieldWrapper>

      <div className="admin-signup-welcome-sms__actions">
        <FormButton
          htmlType="button"
          variant="primary"
          className="button button--primary"
          onClick={() => void onSave()}
          loading={saving}
          loadingText="저장 중…"
          disabled={loading}
        >
          문구 저장
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary"
          onClick={onCancelEdit}
          disabled={loading || saving}
        >
          수정 취소
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary"
          onClick={() => void onReset()}
          disabled={loading || saving}
        >
          기본 문구로 복원
        </FormButton>
      </div>

      <details
        className="admin-signup-welcome-sms__default-details"
        open={showDefaultPreview}
        onToggle={(e) => setShowDefaultPreview((e.target as HTMLDetailsElement).open)}
      >
        <summary>기본 문구 확인</summary>
        <pre className="admin-signup-welcome-sms__readonly">{settings?.defaultMessage ?? '—'}</pre>
      </details>
    </section>
  )
}
