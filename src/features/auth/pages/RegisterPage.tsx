import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import { checkUsernameAvailability, login as loginApi, register as registerApi } from '../authApi'

type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>('idle')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

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

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    const code = inviteCode.trim()
    const nameTrim = name.trim()
    const userTrim = username.trim()

    if (!code) {
      setErrorMessage('GA 코드(초대 코드)를 입력하세요.')
      return
    }
    if (!nameTrim) {
      setErrorMessage('이름을 입력하세요.')
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
    const phoneDigits = normalizeKrMobile(phone)
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
      return <p className="status" style={{ color: '#15803d' }}>사용 가능한 아이디입니다.</p>
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
    isSubmitting || usernameCheck === 'checking' || usernameCheck === 'taken' || usernameCheck === 'invalid'

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <h1>회원가입</h1>
        <p className="auth-description">소속 GA에서 안내받은 초대 코드로 가입합니다.</p>

        <form className="auth-form" onSubmit={(e) => void handleSignup(e)}>
          <label className="field">
            <span className="field__label">GA 코드 (invite_code)</span>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              placeholder="예: YJASSET"
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
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01012345678 또는 010-1234-5678"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">아이디</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
              <input
                style={{ flex: '1 1 160px', minWidth: 0 }}
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

          {errorMessage ? <p className="status status--error">{errorMessage}</p> : null}

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
