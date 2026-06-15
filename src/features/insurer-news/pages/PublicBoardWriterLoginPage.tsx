import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton, FormInput } from '../../../components/form'
import {
  loginPublicBoardWriter,
  setPublicBoardWriterToken,
} from '../services/publicBoardWriter.service'
import './public-board-writer.css'

export function PublicBoardWriterLoginPage() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (busy) {
      return
    }
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const res = await loginPublicBoardWriter(loginId.trim(), password)
        setPublicBoardWriterToken(res.token)
        navigate('/public-board-writer/workspace', { replace: true })
      } catch (e) {
        setError(e instanceof Error ? e.message : '로그인에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <main className="page public-board-writer-login-page user-page">
      <section className="public-board-writer-card">
        <h1>공용 게시판 작성자 로그인</h1>
        <p>전체 공용 게시판 글 작성 전용 계정으로 로그인합니다. 일반 CRM 계정과 분리됩니다.</p>
        <label className="form-field">
          <span className="form-label">아이디</span>
          <FormInput value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" />
        </label>
        <label className="form-field">
          <span className="form-label">비밀번호</span>
          <FormInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="status status--error">{error}</p> : null}
        <FormButton htmlType="button" variant="primary" disabled={busy} onClick={handleSubmit}>
          {busy ? '로그인 중...' : '로그인'}
        </FormButton>
      </section>
    </main>
  )
}
