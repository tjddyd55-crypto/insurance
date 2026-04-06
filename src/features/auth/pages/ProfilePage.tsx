import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import {
  fetchMe,
  patchMe,
  sendPhoneChangeCode,
  verifyPhoneChangeCode,
  type MeResponse,
} from '../authApi'
import { useAuth } from '../AuthProvider'
import { CustomerExcelImportPanel } from '../../customers/components/CustomerExcelImportPanel'

const CODE_TTL_SEC = 180
const RESEND_COOLDOWN_SEC = 60

export function ProfilePage() {
  const { token, user, login, isAuthenticated } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneEditDigits, setPhoneEditDigits] = useState('')
  const [code, setCode] = useState('')
  const [phoneChangeProof, setPhoneChangeProof] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [resendLeft, setResendLeft] = useState(0)
  const [debugCodeHint, setDebugCodeHint] = useState('')

  useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [secondsLeft > 0])

  useEffect(() => {
    if (resendLeft <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setResendLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [resendLeft > 0])

  const load = useCallback(async () => {
    if (!token) {
      return
    }
    setLoadError('')
    try {
      const row = await fetchMe(token)
      setMe(row)
      setDisplayName(row.display_name)
      setPhoneInput(row.phone_number)
      setPhoneEditDigits(row.phone_number)
      setPhoneChangeProof(null)
      setCode('')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '프로필을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated || !token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'USER') {
    return <Navigate to="/dashboard" replace />
  }

  const normalizedEditPhone = normalizeKrMobile(phoneEditDigits)
  const phoneChangedPending =
    normalizedEditPhone !== '' && normalizedEditPhone !== normalizeKrMobile(me?.phone_number ?? '')

  const sendCode = async () => {
    if (!token) {
      return
    }
    setErrorMessage('')
    setInfoMessage('')
    const pErr = validateKrMobileDigits(normalizedEditPhone)
    if (pErr) {
      setErrorMessage(pErr)
      return
    }
    if (!phoneChangedPending) {
      setErrorMessage('변경할 휴대폰 번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const r = await sendPhoneChangeCode(token, normalizedEditPhone)
      setInfoMessage(r.message ?? '인증번호를 발급했습니다.')
      if (r.debugCode) {
        setDebugCodeHint(`(개발용) 인증번호: ${r.debugCode}`)
      } else {
        setDebugCodeHint('')
      }
      setSecondsLeft(CODE_TTL_SEC)
      setResendLeft(RESEND_COOLDOWN_SEC)
      setCode('')
      setPhoneChangeProof(null)
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMessage(e.message)
        if (e.retryAfterSec != null) {
          setResendLeft(e.retryAfterSec)
        }
      } else {
        setErrorMessage(e instanceof Error ? e.message : '요청에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async () => {
    if (!token) {
      return
    }
    setErrorMessage('')
    setInfoMessage('')
    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMessage('인증번호 6자리를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const r = await verifyPhoneChangeCode(token, normalizedEditPhone, code.trim())
      setPhoneChangeProof(r.phone_change_proof)
      setInfoMessage(r.message ?? '인증이 완료되었습니다. 저장을 눌러 반영합니다.')
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMessage(e.message)
      } else {
        setErrorMessage(e instanceof Error ? e.message : '인증에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) {
      return
    }
    setErrorMessage('')
    setInfoMessage('')
    const nameTrim = displayName.trim()
    if (!nameTrim) {
      setErrorMessage('이름을 입력해 주세요.')
      return
    }

    const payload: {
      display_name: string
      phone_number?: string
      phone_change_proof?: string
    } = { display_name: nameTrim }

    if (phoneChangedPending) {
      if (!phoneChangeProof) {
        setErrorMessage('휴대폰 번호 변경을 위해 인증을 완료해 주세요.')
        return
      }
      payload.phone_number = normalizedEditPhone
      payload.phone_change_proof = phoneChangeProof
    }

    setSavingProfile(true)
    try {
      const updated = await patchMe(token, payload)
      setMe(updated)
      setPhoneInput(updated.phone_number)
      setPhoneEditDigits(updated.phone_number)
      setPhoneChangeProof(null)
      setCode('')
      login({
        token,
        user: {
          ...user,
          displayName: updated.display_name,
        },
      })
      setInfoMessage('저장했습니다.')
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMessage(e.message)
      } else {
        setErrorMessage(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const teamDev = () => {
    window.alert('개발중입니다.')
  }

  if (loadError) {
    return (
      <main className="auth-page">
        <section className="card auth-card">
          <h1>프로필</h1>
          <p className="status status--error">{loadError}</p>
          <button type="button" className="button button--secondary" onClick={() => void load()}>
            다시 시도
          </button>
        </section>
      </main>
    )
  }

  if (!me) {
    return (
      <main className="auth-page">
        <section className="card auth-card">
          <h1>프로필</h1>
          <p className="status">불러오는 중…</p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>프로필</h1>
        <p className="auth-description">이름·휴대폰을 관리하고 비밀번호 재설정으로 보안을 유지하세요.</p>

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span className="field__label">이름</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">아이디</span>
            <input value={me.username} readOnly />
          </label>

          <label className="field">
            <span className="field__label">휴대폰 번호</span>
            <input
              value={phoneEditDigits}
              onChange={(e) => {
                setPhoneEditDigits(e.target.value)
                setPhoneChangeProof(null)
              }}
              inputMode="numeric"
              autoComplete="tel"
              placeholder={phoneInput}
              required
            />
          </label>

          {phoneChangedPending ? (
            <div className="field">
              <span className="field__label">휴대폰 변경 인증</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void sendCode()}
                  disabled={submitting || resendLeft > 0}
                >
                  {resendLeft > 0 ? `재요청 (${resendLeft}s)` : '인증번호 요청'}
                </button>
                {secondsLeft > 0 ? (
                  <span className="status" style={{ fontSize: '0.9rem' }}>
                    유효 시간 {secondsLeft}s
                  </span>
                ) : null}
              </div>
              <input
                style={{ marginTop: 8 }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="인증번호 6자리"
                maxLength={6}
              />
              <button
                type="button"
                className="button button--secondary"
                style={{ marginTop: 8 }}
                onClick={() => void verifyCode()}
                disabled={submitting || code.trim().length !== 6}
              >
                인증 확인
              </button>
              {phoneChangeProof ? (
                <p className="status" style={{ color: 'var(--success)' }}>
                  인증 완료 — 저장 시 새 번호가 반영됩니다.
                </p>
              ) : null}
              {debugCodeHint ? <p className="status">{debugCodeHint}</p> : null}
            </div>
          ) : null}

          <div className="field">
            <span className="field__label">비밀번호</span>
            <Link to="/password-reset" className="button button--secondary" style={{ display: 'inline-block' }}>
              비밀번호 변경 (SMS 재설정)
            </Link>
          </div>

          <div className="field">
            <span className="field__label">고객 엑셀 업로드</span>
            <p className="auth-description" style={{ marginTop: 4, fontSize: 13 }}>
              샘플 다운로드·파일 선택·미리보기·일괄 등록은 프로필에서 진행합니다. 완료 후 고객 관리에서 목록을 확인하세요.
            </p>
            <CustomerExcelImportPanel token={token} onUploadsFinished={() => {}} />
          </div>

          <div className="field">
            <span className="field__label">계정</span>
            <Link to="/account/reset" className="button button--secondary" style={{ display: 'inline-block' }}>
              계정 초기화
            </Link>
          </div>

          <div className="field">
            <span className="field__label">팀 연결</span>
            <button type="button" className="button button--secondary" onClick={teamDev}>
              팀 연결
            </button>
          </div>

          {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}
          {infoMessage ? <p className="status">{infoMessage}</p> : null}

          <button
            className="button button--primary button--full"
            type="submit"
            disabled={savingProfile || (phoneChangedPending && !phoneChangeProof)}
          >
            {savingProfile ? '저장 중…' : '저장'}
          </button>
        </form>

        <div className="switch-text">
          <Link to="/dashboard" className="switch-text__action">
            대시보드로
          </Link>
        </div>
      </section>
    </main>
  )
}
