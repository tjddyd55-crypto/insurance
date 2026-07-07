import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import {
  checkUsernameAvailability,
  login as loginApi,
  register as registerApi,
  sendSignupPhoneCode,
  validateGaCodeForSignup,
  validateTenantRegistrationCodeForSignup,
  verifySignupPhoneCode,
  fetchSignupPhonePolicy,
} from '../authApi'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../AuthProvider'
import { resolveAuthLandingPath } from '../landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { isInsuranceBillingEnabledClient } from '../../insurance-billing/insuranceBillingConfig'
import {
  validateReferralCodeForSignup,
} from '../../referrals/referralApi'
import { isFreeLaunchBillingUiHidden } from '../../billing/freeLaunchPolicy'
import {
  getSignupUsernameValidationError,
  SIGNUP_USERNAME_RULE_MESSAGE,
} from '../signupUsername'

type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const INVITE_REF_USER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseSignupRefQueryParam(ref: string): { inviteRefUserId: string; referralFromUrl: string } {
  const trimmed = ref.trim()
  if (!trimmed) {
    return { inviteRefUserId: '', referralFromUrl: '' }
  }
  if (INVITE_REF_USER_UUID_RE.test(trimmed)) {
    return { inviteRefUserId: trimmed, referralFromUrl: '' }
  }
  return { inviteRefUserId: '', referralFromUrl: trimmed.toUpperCase().replace(/\s+/g, '') }
}

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

export type SignupIndustry = 'insurance' | 'gym' | 'government'

export function RegisterPage({ signupIndustry = 'insurance' }: { signupIndustry?: SignupIndustry }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, login } = useAuth()
  const tenantCodeMode = signupIndustry === 'gym' || signupIndustry === 'government'
  const [gaCode, setGaCode] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
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
  const [referralCode, setReferralCode] = useState('')
  const [referralCodeHint, setReferralCodeHint] = useState('')
  const [referralCodeError, setReferralCodeError] = useState('')
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null)
  const [devPhoneBypassEnabled, setDevPhoneBypassEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const policy = await fetchSignupPhonePolicy()
      if (!cancelled) {
        setDevPhoneBypassEnabled(Boolean(policy.devBypassEnabled))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    const refRaw = searchParams.get('ref')?.trim() ?? ''
    const { inviteRefUserId: refUserId, referralFromUrl } = parseSignupRefQueryParam(refRaw)
    setInviteRefUserId(refUserId)
    if (referralFromUrl) {
      setReferralCode((prev) => (prev.trim() !== '' ? prev : referralFromUrl))
    }
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
    if (tenantCodeMode) {
      return
    }
    const raw = gaCode.trim()
    if (!raw) {
      setGaInfo('공용 소속(기본)으로 가입됩니다.')
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
          if (data.success && data.gaName?.trim()) {
            setGaInfo(data.gaName.trim())
            setGaError('')
          } else {
            setGaInfo(null)
            setGaError('조회 되지 않습니다.')
          }
        } catch {
          if (cancelled) {
            return
          }
          setGaInfo(null)
          setGaError('조회 되지 않습니다.')
        }
      })()
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [gaCode, tenantCodeMode])

  useEffect(() => {
    if (!tenantCodeMode) {
      return
    }
    const raw = registrationCode.trim()
    if (!raw) {
      setGaInfo(null)
      setGaError('')
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await validateTenantRegistrationCodeForSignup({
            industryCode: signupIndustry,
            registrationCode: raw,
          })
          if (cancelled) {
            return
          }
          if (data.ok && data.tenantName?.trim()) {
            setGaInfo(data.tenantName.trim())
            setGaError('')
          } else {
            setGaInfo(null)
            setGaError(data.message ?? '조회 되지 않습니다.')
          }
        } catch {
          if (cancelled) {
            return
          }
          setGaInfo(null)
          setGaError('조회 되지 않습니다.')
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [registrationCode, signupIndustry, tenantCodeMode])

  useEffect(() => {
    const raw = referralCode.trim().toUpperCase().replace(/\s+/g, '')
    if (!raw) {
      setReferralCodeHint('')
      setReferralCodeError('')
      setReferralCodeValid(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await validateReferralCodeForSignup(raw)
          if (cancelled) {
            return
          }
          if (data.valid) {
            setReferralCodeValid(true)
            setReferralCodeHint(data.benefitSummary ?? data.message ?? '추천인 코드가 확인되었습니다.')
            setReferralCodeError('')
          } else {
            setReferralCodeValid(false)
            setReferralCodeHint('')
            setReferralCodeError(data.message ?? '유효하지 않은 추천인 코드입니다.')
          }
        } catch {
          if (cancelled) {
            return
          }
          setReferralCodeValid(false)
          setReferralCodeHint('')
          setReferralCodeError('유효하지 않은 추천인 코드입니다.')
        }
      })()
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [referralCode])

  const resetUsernameCheck = () => {
    setUsernameCheck('idle')
  }

  const runUsernameCheck = async (raw: string) => {
    const u = raw.trim()
    if (!u) {
      setUsernameCheck('idle')
      return
    }
    if (getSignupUsernameValidationError(u)) {
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
  const regCodeTrim = registrationCode.trim().replace(/\s+/g, '').toUpperCase()
  const needsPhoneAuth = !devPhoneBypassEnabled

  const requestSignupSms = async () => {
    setErrorMessage('')
    setInfoMessage('')
    const pErr = validateKrMobileDigits(phoneDigits)
    if (pErr) {
      setErrorMessage(pErr)
      return
    }
    if (tenantCodeMode) {
      if (!regCodeTrim) {
        setErrorMessage('테넌트 가입 코드를 먼저 입력하세요.')
        return
      }
    }
    setSmsSubmitting(true)
    try {
      const r = tenantCodeMode
        ? await sendSignupPhoneCode({
            industryCode: signupIndustry,
            registrationCode: regCodeTrim,
            phoneNumber: phoneDigits,
          })
        : await sendSignupPhoneCode({
            inviteCode: gaCodeTrim || undefined,
            phoneNumber: phoneDigits,
          })
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
        setErrorMessage(
          e.message || '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        )
        if (e.retryAfterSec != null) {
          setResendLeft(e.retryAfterSec)
        }
      } else {
        setErrorMessage(
          e instanceof Error ? e.message : '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        )
      }
    } finally {
      setSmsSubmitting(false)
    }
  }

  const handleVerifyCode = async () => {
    setErrorMessage('')
    setInfoMessage('')
    if (tenantCodeMode) {
      if (!regCodeTrim) {
        setErrorMessage('테넌트 가입 코드를 입력하세요.')
        return
      }
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
      const r = (tenantCodeMode
        ? await verifySignupPhoneCode({
            industryCode: signupIndustry,
            registrationCode: regCodeTrim,
            phoneNumber: phoneDigits,
            code: smsCode.trim(),
          })
        : await verifySignupPhoneCode({
            inviteCode: gaCodeTrim || undefined,
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

    const phoneErrSubmit = validateKrMobileDigits(phoneDigits)
    if (phoneErrSubmit) {
      setErrorMessage(phoneErrSubmit)
      return
    }
    if (needsPhoneAuth && !isVerified) {
      setErrorMessage('휴대폰 인증을 완료해 주세요.')
      return
    }

    const nameTrim = name.trim()
    const userTrim = username.trim()
    const refTrim = inviteRefUserId.trim()
    const sigTrim = inviteSig.trim()
    const tsTrim = inviteTs.trim()
    if (tenantCodeMode) {
      if (!regCodeTrim) {
        setErrorMessage('테넌트 가입 코드를 입력하세요.')
        return
      }
      if (refTrim) {
        setErrorMessage('테넌트 가입 경로에서는 담당자 초대(ref) 매개변수와 함께 가입할 수 없습니다.')
        return
      }
    }
    if (!userTrim) {
      setErrorMessage('아이디를 입력하세요.')
      return
    }
    const usernameValidationError = getSignupUsernameValidationError(userTrim)
    if (usernameValidationError) {
      setUsernameCheck('invalid')
      setErrorMessage(usernameValidationError)
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

    const referralCodeNorm = referralCode.trim().toUpperCase().replace(/\s+/g, '')
    if (referralCodeNorm && referralCodeValid === false) {
      setErrorMessage('유효하지 않은 추천인 코드입니다.')
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
      if (tenantCodeMode) {
        await registerApi({
          username: userTrim,
          password,
          industryCode: signupIndustry,
          registrationCode: regCodeTrim,
          name: nameTrim,
          phoneNumber: phoneDigits || undefined,
          signupPhoneProof: signupPhoneProof ?? undefined,
          referralCode: referralCodeNorm || undefined,
        })
      } else {
        await registerApi({
          username: userTrim,
          password,
          inviteCode: gaCodeTrim || undefined,
          refUserId: refTrim || undefined,
          inviteSig: sigTrim || undefined,
          inviteTs: tsTrim || undefined,
          name: nameTrim,
          phoneNumber: phoneDigits || undefined,
          signupPhoneProof: signupPhoneProof ?? undefined,
          referralCode: referralCodeNorm || undefined,
        })
      }
      const session = await loginApi(userTrim, password)
      if (session.authKind === 'BOARD_WRITER') {
        navigate(session.redirectPath || '/board-writer/workspace', { replace: true })
        return
      }
      login({ token: session.token, user: session.user })
      if (
        signupIndustry === 'insurance' &&
        isInsuranceBillingEnabledClient() &&
        !isFreeLaunchBillingUiHidden()
      ) {
        navigate('/billing/checkout', { replace: true })
        return
      }
      navigate(resolveAuthLandingPath(isMobile, session.user?.role), { replace: true })
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
      const msg = getSignupUsernameValidationError(username.trim())
      return (
        <p className="status status--error">{msg ?? SIGNUP_USERNAME_RULE_MESSAGE}</p>
      )
    }
    return null
  }

  const usernameValidationError = getSignupUsernameValidationError(username)
  const signupSubmitDisabled =
    isSubmitting ||
    (needsPhoneAuth && !isVerified) ||
    Boolean(usernameValidationError)

  const smsRequestDisabled = smsSubmitting || resendLeft > 0 || isVerified
  const smsConfirmDisabled = smsSubmitting || smsCode.trim().length !== 6 || isVerified

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>
          {tenantCodeMode ?
            signupIndustry === 'gym' ?
              '회원가입 · 체육관'
            : '회원가입 · 공공기관'
          : '회원가입'}
        </h1>

        <form className="auth-form auth-form--register" onSubmit={(e) => void handleSignup(e)}>
          <FormInput type="hidden" name="invite_ref_user_id" value={inviteRefUserId} aria-hidden />
          <FormInput type="hidden" name="invite_sig" value={inviteSig} aria-hidden />
          <FormInput type="hidden" name="invite_ts" value={inviteTs} aria-hidden />
          {tenantCodeMode ?
            <label className="field">
              <span className="field__label">가입 코드</span>
              <p className="text-xs text-gray-400 mb-2">테넌트에서 발급한 코드입니다. 업종별 화면에 맞는 코드만 입력하세요.</p>
              <FormInput
                value={registrationCode}
                onChange={(e) => {
                  setRegistrationCode(e.target.value.toUpperCase().replace(/\s+/g, ''))
                  setIsVerified(false)
                  setSignupPhoneProof(null)
                }}
                autoComplete="off"
                placeholder="가입 코드"
                required
              />
              {gaInfo ? <div className="ga-success">{`사업장: ${gaInfo}`}</div> : null}
              {gaError ? <div className="ga-error">{gaError}</div> : null}
            </label>
          : <label className="field">
              <span className="field__label">GA 코드 (선택)</span>
              <p className="text-xs text-gray-400 mb-2">
                소속 코드가 있으면 입력하세요. 비워 두면 공용 소속으로 가입됩니다.
              </p>
              <FormInput
                value={gaCode}
                onChange={(e) => {
                  setGaCode(e.target.value.toUpperCase())
                  setIsVerified(false)
                  setSignupPhoneProof(null)
                }}
                autoComplete="off"
                placeholder="소속 코드 (없으면 비워 두세요)"
              />
              {gaInfo ? <div className="ga-success">{`조회결과: ${gaInfo}`}</div> : null}
              {gaError ? <div className="ga-error">{gaError}</div> : null}
            </label>
          }

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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
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

          <label className="field">
            <span className="field__label">추천인 코드</span>
            <FormInput
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
              autoComplete="off"
              placeholder="추천인 코드가 있으면 입력해 주세요"
            />
            {referralCodeHint ? (
              <p className="status" style={{ color: 'var(--success)' }}>
                {referralCodeHint}
              </p>
            ) : null}
            {referralCodeError ? <p className="status status--error">{referralCodeError}</p> : null}
          </label>

          <div className="verify-section">
            {devPhoneBypassEnabled ? (
              <p className="status" style={{ color: 'var(--text-secondary)' }}>
                develop 환경: 휴대폰 SMS 인증 없이 가입할 수 있습니다. (테스트용)
              </p>
            ) : null}
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
                required
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
