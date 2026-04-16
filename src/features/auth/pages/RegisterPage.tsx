import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import { isSignupPhoneRelaxedMode } from '../../../lib/signupPhoneRelaxed'
import {
  checkUsernameAvailability,
  login as loginApi,
  register as registerApi,
  sendSignupPhoneCode,
  validateGaCodeForSignup,
  verifySignupPhoneCode,
} from '../authApi'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../AuthProvider'

type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const CODE_TTL_SEC = 180
const RESEND_COOLDOWN_SEC = 60

type VerifySignupResponseLike = {
  ok?: boolean
  success?: boolean
  message?: string
  signup_phone_proof?: string
  data?: {
    ok?: boolean
    success?: boolean
    message?: string
    signup_phone_proof?: string
  }
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, login } = useAuth()
  const [gaCode, setGaCode] = useState('')
  const [gaInfo, setGaInfo] = useState<string | null>(null)
  const [gaError, setGaError] = useState('')
  const [inviteRefUserId, setInviteRefUserId] = useState('')
  const [inviteSig, setInviteSig] = useState('')
  const [inviteTs, setInviteTs] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [signupPhoneProof, setSignupPhoneProof] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [smsSubmitting, setSmsSubmitting] = useState(false)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [resendLeft, setResendLeft] = useState(0)
  const [debugCodeHint, setDebugCodeHint] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const ga = searchParams.get('ga')?.trim()
    if (ga) {
      setGaCode((prev) => (prev.trim() !== '' ? prev : ga.toUpperCase()))
    }
    const ref = searchParams.get('ref')?.trim()
    setInviteRefUserId(ref ?? '')
    const sig = searchParams.get('sig')?.trim()
    setInviteSig(sig ?? '')
    const ts = searchParams.get('ts')?.trim()
    setInviteTs(ts ?? '')
  }, [searchParams])

  useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [secondsLeft])

  useEffect(() => {
    if (resendLeft <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setResendLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [resendLeft])

  useEffect(() => {
    console.log({ isVerified, gaCode, gaInfo })
  }, [isVerified, gaCode, gaInfo])

  useEffect(() => {
    const raw = gaCode.trim()
    if (!raw) {
      setGaInfo(null)
      setGaError('')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await validateGaCodeForSignup(raw)
          if (cancelled) {
            return
          }
          if (data.success && data.gaName) {
            setGaInfo(data.gaName)
            setGaError('')
          } else {
            setGaInfo(null)
            setGaError('존재하지 않는 GA 코드입니다.')
          }
        } catch {
          if (cancelled) {
            return
          }
          setGaInfo(null)
          setGaError('조회 실패')
        }
      })()
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [gaCode])

  const resetUsernameCheck = () => {
    setUsernameCheck('idle')
  }

  const runUsernameCheck = async (raw: string) => {
    const u = raw.trim()
    if (!u) {
      setUsernameCheck('idle')
      return
    }
    if (u.length < 3 || u.length > 30 || /\s/.test(u)) {
      setUsernameCheck('invalid')
      return
    }
    setUsernameCheck('checking')
    try {
      const ok = await checkUsernameAvailability(u)
      setUsernameCheck(ok ? 'available' : 'taken')
    } catch {
      setUsernameCheck('idle')
    }
  }

  const phoneDigits = normalizeKrMobile(phone)
  const gaCodeTrim = gaCode.trim()
  const needsPhoneAuth = !isSignupPhoneRelaxedMode() || Boolean(phoneDigits)

  const requestSignupSms = async () => {
    setErrorMessage('')
    setInfoMessage('')
    const pErr = validateKrMobileDigits(phoneDigits)
    if (pErr) {
      setErrorMessage(pErr)
      return
    }
    if (!gaCodeTrim) {
      setErrorMessage('GA 코드를 먼저 입력하세요.')
      return
    }
    setSmsSubmitting(true)
    try {
      const r = await sendSignupPhoneCode({ inviteCode: gaCodeTrim, phoneNumber: phoneDigits })
      setInfoMessage(r.message ?? '인증번호를 발송했습니다.')
      if (r.debugCode) {
        setDebugCodeHint(`(개발용) 인증번호: ${r.debugCode}`)
      } else {
        setDebugCodeHint('')
      }
      setSecondsLeft(CODE_TTL_SEC)
      setResendLeft(RESEND_COOLDOWN_SEC)
      setSmsCode('')
      setSignupPhoneProof(null)
      setIsVerified(false)
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMessage(e.message)
        if (e.retryAfterSec != null) {
          setResendLeft(e.retryAfterSec)
        }
      } else {
        setErrorMessage(e instanceof Error ? e.message : '인증번호 요청에 실패했습니다.')
      }
    } finally {
      setSmsSubmitting(false)
    }
  }

  const handleVerifyCode = async () => {
    setErrorMessage('')
    setInfoMessage('')
    if (!gaCodeTrim) {
      setErrorMessage('GA 코드를 입력하세요.')
      return
    }
    const pErr = validateKrMobileDigits(phoneDigits)
    if (pErr) {
      setErrorMessage(pErr)
      return
    }
    if (!/^\d{6}$/.test(smsCode.trim())) {
      setErrorMessage('인증번호 6자리를 입력하세요.')
      return
    }
    setSmsSubmitting(true)
    try {
      const r = (await verifySignupPhoneCode({
        inviteCode: gaCodeTrim,
        phoneNumber: phoneDigits,
        code: smsCode.trim(),
      })) as VerifySignupResponseLike
      const verified = Boolean(r?.success || r?.data?.success || r?.ok || r?.data?.ok)
      const proof = String(r.signup_phone_proof ?? r.data?.signup_phone_proof ?? '').trim()

      setIsVerified(verified)
      if (verified) {
        setSignupPhoneProof(proof || null)
        setInfoMessage(r.message ?? r.data?.message ?? '휴대폰 인증이 완료되었습니다.')
      } else {
        setSignupPhoneProof(null)
        setErrorMessage('인증번호가 일치하지 않습니다.')
      }
    } catch (e) {
      setIsVerified(false)
      setSignupPhoneProof(null)
      if (e instanceof ApiError) {
        setErrorMessage(e.message)
      } else {
        setErrorMessage(e instanceof Error ? e.message : '인증에 실패했습니다.')
      }
    } finally {
      setSmsSubmitting(false)
    }
  }

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')

    if (needsPhoneAuth && !isVerified) {
      alert('휴대폰 인증을 완료해주세요.')
      return
    }

    const code = gaCodeTrim
    const nameTrim = name.trim()
    const userTrim = username.trim()
    const refTrim = inviteRefUserId.trim()

    if (!refTrim) {
      setErrorMessage('담당자 초대 링크로 접속해 주세요. (주소에 ref 가 포함되어야 합니다)')
      return
    }
    const sigTrim = inviteSig.trim()
    const tsTrim = inviteTs.trim()
    if (!sigTrim || !tsTrim) {
      setErrorMessage('초대 링크가 불완전합니다. 담당자에게 다시 공유받은 링크로 접속해 주세요.')
      return
    }
    if (!code) {
      setErrorMessage('GA 코드를 입력하세요.')
      return
    }
    if (!userTrim) {
      setErrorMessage('아이디를 입력하세요.')
      return
    }
    if (userTrim.length < 3 || userTrim.length > 30 || /\s/.test(userTrim)) {
      setErrorMessage('아이디는 3~30자이며 공백을 포함할 수 없습니다.')
      return
    }
    if (!password) {
      setErrorMessage('비밀번호를 입력하세요.')
      return
    }
    if (!confirmPassword) {
      setErrorMessage('비밀번호 확인을 입력하세요.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!nameTrim) {
      setErrorMessage('이름을 입력하세요.')
      return
    }
    if (!isSignupPhoneRelaxedMode()) {
      const phoneErr = validateKrMobileDigits(phoneDigits)
      if (phoneErr) {
        setErrorMessage(phoneErr)
        return
      }
    } else if (phoneDigits) {
      const phoneErr = validateKrMobileDigits(phoneDigits)
      if (phoneErr) {
        setErrorMessage(phoneErr)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const available = await checkUsernameAvailability(userTrim)
      if (!available) {
        setUsernameCheck('taken')
        setErrorMessage('이미 사용 중인 아이디입니다.')
        return
      }
      setUsernameCheck('available')
      await registerApi({
        username: userTrim,
        password,
        inviteCode: code,
        refUserId: refTrim,
        inviteSig: sigTrim,
        inviteTs: tsTrim,
        name: nameTrim,
        phoneNumber: phoneDigits || undefined,
        signupPhoneProof: signupPhoneProof ?? undefined,
      })
      const session = await loginApi(userTrim, password)
      login(session)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '회원가입에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const usernameStatusMessage = () => {
    if (usernameCheck === 'checking') {
      return <p className="status">확인 중…</p>
    }
    if (usernameCheck === 'available') {
      return (
        <p className="status" style={{ color: 'var(--success)' }}>
          사용 가능한 아이디입니다.
        </p>
      )
    }
    if (usernameCheck === 'taken') {
      return <p className="status status--error">이미 사용 중인 아이디입니다.</p>
    }
    if (usernameCheck === 'invalid') {
      return <p className="status status--error">아이디는 3~30자이며 공백을 포함할 수 없습니다.</p>
    }
    return null
  }

  const signupSubmitDisabled = isSubmitting || (needsPhoneAuth && !isVerified)

  const smsRequestDisabled = smsSubmitting || resendLeft > 0 || isVerified
  const smsConfirmDisabled = smsSubmitting || smsCode.trim().length !== 6 || isVerified

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>회원가입</h1>

        <form className="auth-form auth-form--register" onSubmit={(e) => void handleSignup(e)}>
          <FormInput type="hidden" name="invite_ref_user_id" value={inviteRefUserId} aria-hidden />
          <FormInput type="hidden" name="invite_sig" value={inviteSig} aria-hidden />
          <FormInput type="hidden" name="invite_ts" value={inviteTs} aria-hidden />
          <label className="field">
            <span className="field__label">GA 코드</span>
            <p className="text-xs text-gray-400 mb-2">부여받은 코드를 입력하세요.</p>
            <FormInput
              value={gaCode}
              onChange={(e) => {
                setGaCode(e.target.value.toUpperCase())
                setIsVerified(false)
                setSignupPhoneProof(null)
              }}
              autoComplete="off"
              placeholder="부여받은 소속코드를 입력하세요"
              required
            />
            {gaInfo ? <div className="ga-success">{gaInfo}</div> : null}
            {gaError ? <div className="ga-error">{gaError}</div> : null}
          </label>

          <label className="field">
            <span className="field__label">아이디</span>
            <div className="register-field-row">
              <FormInput
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  resetUsernameCheck()
                }}
                onBlur={() => void runUsernameCheck(username)}
                autoComplete="username"
                placeholder="로그인에 사용할 아이디"
                required
              />
              <FormButton
                htmlType="button"
                variant="secondary"
                className="button button--secondary"
                onClick={() => void runUsernameCheck(username)}
                disabled={isSubmitting || username.trim().length < 3}
              >
                중복 확인
              </FormButton>
            </div>
          </label>
          {usernameStatusMessage()}

          <label className="field">
            <span className="field__label">비밀번호</span>
            <FormInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="비밀번호"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">비밀번호 확인</span>
            <FormInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">이름</span>
            <FormInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="실명 또는 표시 이름"
              required
            />
          </label>

          <div className="verify-section">
            <div className="verify-overlay" aria-hidden="true" />
            <label className="field">
              <span className="field__label">휴대폰 번호</span>
              <FormInput
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setIsVerified(false)
                  setSignupPhoneProof(null)
                }}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01012345678 또는 010-1234-5678"
                required={!isSignupPhoneRelaxedMode()}
              />
            </label>

            <div className="field">
              <span className="field__label">휴대폰 인증</span>
              <div className="register-phone-request-row">
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="button button--secondary"
                  onClick={() => void requestSignupSms()}
                  disabled={smsRequestDisabled}
                >
                  {resendLeft > 0 ? `재요청 (${resendLeft}s)` : '인증번호 요청'}
                </FormButton>
                {secondsLeft > 0 ? (
                  <span className="status" style={{ fontSize: '0.9rem' }}>
                    유효 시간 {secondsLeft}s
                  </span>
                ) : null}
              </div>
            </div>

            <label className="field">
              <span className="field__label">인증번호</span>
              <FormInput
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                inputMode="numeric"
                placeholder="인증번호 6자리"
                maxLength={6}
                disabled={isVerified}
              />
            </label>

            <FormButton
              htmlType="button"
              variant="secondary"
              className="button button--secondary"
              onClick={() => void handleVerifyCode()}
              disabled={smsConfirmDisabled}
            >
              인증 확인
            </FormButton>

            {isVerified ? (
              <p className="status" style={{ color: 'var(--success)' }}>
                인증 완료
              </p>
            ) : null}
          </div>
          {debugCodeHint ? <p className="status">{debugCodeHint}</p> : null}

          {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}
          {infoMessage ? <p className="status">{infoMessage}</p> : null}

          <FormButton
            className="button button--primary button--full signup-button"
            htmlType="submit"
            variant="primary"
            disabled={signupSubmitDisabled}
          >
            {isSubmitting ? '가입 중…' : '가입'}
          </FormButton>
        </form>

        <div className="switch-text">
          이미 계정이 있나요?
          <Link to="/login" className="switch-text__action">
            로그인
          </Link>
        </div>
      </section>
    </main>
  )
}
