import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import {
  checkUsernameAvailability,
  login as loginApi,
  register as registerApi,
  sendSignupPhoneCode,
  verifySignupPhoneCode,
} from '../authApi'
import { useAuth } from '../AuthProvider'

type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const CODE_TTL_SEC = 180
const RESEND_COOLDOWN_SEC = 60

export function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [signupPhoneProof, setSignupPhoneProof] = useState<string | null>(null)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
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
  const inviteTrim = inviteCode.trim()

  const requestSignupSms = async () => {
    setErrorMessage('')
    setInfoMessage('')
    const pErr = validateKrMobileDigits(phoneDigits)
    if (pErr) {
      setErrorMessage(pErr)
      return
    }
    if (!inviteTrim) {
      setErrorMessage('GA 코드를 먼저 입력하세요.')
      return
    }
    setSmsSubmitting(true)
    try {
      const r = await sendSignupPhoneCode({ inviteCode: inviteTrim, phoneNumber: phoneDigits })
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
      setIsPhoneVerified(false)
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

  const confirmSignupSms = async () => {
    setErrorMessage('')
    setInfoMessage('')
    if (!inviteTrim) {
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
      const r = await verifySignupPhoneCode({
        inviteCode: inviteTrim,
        phoneNumber: phoneDigits,
        code: smsCode.trim(),
      })
      setSignupPhoneProof(r.signup_phone_proof)
      setIsPhoneVerified(true)
      setInfoMessage(r.message ?? '휴대폰 인증이 완료되었습니다.')
    } catch (e) {
      setIsPhoneVerified(false)
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

    if (!isPhoneVerified || !signupPhoneProof) {
      alert('휴대폰 인증을 완료해주세요.')
      return
    }

    const code = inviteTrim
    const nameTrim = name.trim()
    const userTrim = username.trim()

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
    const phoneErr = validateKrMobileDigits(phoneDigits)
    if (phoneErr) {
      setErrorMessage(phoneErr)
      return
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
        name: nameTrim,
        phoneNumber: phoneDigits,
        signupPhoneProof,
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
        <p className="status" style={{ color: '#15803d' }}>
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

  const submitDisabled =
    isSubmitting ||
    !isPhoneVerified ||
    usernameCheck === 'checking' ||
    usernameCheck === 'taken' ||
    usernameCheck === 'invalid'

  const smsRequestDisabled = smsSubmitting || resendLeft > 0 || isPhoneVerified
  const smsConfirmDisabled = smsSubmitting || smsCode.trim().length !== 6 || isPhoneVerified

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>회원가입</h1>
        <p className="auth-description">소속 GA에서 안내받은 초대 코드로 가입합니다.</p>

        <form className="auth-form auth-form--register" onSubmit={(e) => void handleSignup(e)}>
          <label className="field">
            <span className="field__label">GA 코드</span>
            <input
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value)
                setIsPhoneVerified(false)
                setSignupPhoneProof(null)
              }}
              autoComplete="off"
              placeholder="부여받은 소속코드를 입력하세요"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">아이디</span>
            <div className="register-field-row">
              <input
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
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void runUsernameCheck(username)}
                disabled={isSubmitting || username.trim().length < 3}
              >
                중복 확인
              </button>
            </div>
          </label>
          {usernameStatusMessage()}

          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
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
            <input
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="실명 또는 표시 이름"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">휴대폰 번호</span>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setIsPhoneVerified(false)
                setSignupPhoneProof(null)
              }}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01012345678 또는 010-1234-5678"
              required
            />
          </label>

          <div className="field">
            <span className="field__label">휴대폰 인증</span>
            <div className="register-phone-request-row">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void requestSignupSms()}
                disabled={smsRequestDisabled}
              >
                {resendLeft > 0 ? `재요청 (${resendLeft}s)` : '인증번호 요청'}
              </button>
              {secondsLeft > 0 ? (
                <span className="status" style={{ fontSize: '0.9rem' }}>
                  유효 시간 {secondsLeft}s
                </span>
              ) : null}
            </div>
          </div>

          <label className="field">
            <span className="field__label">인증번호</span>
            <input
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              inputMode="numeric"
              placeholder="인증번호 6자리"
              maxLength={6}
              disabled={isPhoneVerified}
            />
          </label>

          <button
            type="button"
            className="button button--secondary"
            onClick={() => void confirmSignupSms()}
            disabled={smsConfirmDisabled}
          >
            인증 확인
          </button>

          {isPhoneVerified ? (
            <p className="status" style={{ color: '#15803d' }}>
              인증 완료
            </p>
          ) : null}
          {debugCodeHint ? <p className="status">{debugCodeHint}</p> : null}

          {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}
          {infoMessage ? <p className="status">{infoMessage}</p> : null}

          <button className="button button--primary button--full" type="submit" disabled={submitDisabled}>
            {isSubmitting ? '가입 중…' : '가입'}
          </button>
        </form>

        <div className="switch-text">
          이미 계정이 있나요?
          <Link to="/login" className="switch-text__action">
            로그인
          </Link>
        </div>

        <p className="auth-legal-links">
          <Link to="/privacy" className="auth-legal-links__a" target="_blank" rel="noopener noreferrer">
            개인정보처리방침
          </Link>
        </p>
      </section>
    </main>
  )
}
