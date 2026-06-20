import { useCallback, useEffect, useState } from 'react'
import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoard } from '../../types'
import {
  checkBoardWriterLoginId,
  createBoardWriterAccountForBoard,
  listBoardWriterAccountsForBoard,
  resetBoardWriterAccountPassword,
  setBoardWriterAccountStatus,
  type PublicBoardWriterAccount,
} from '../../services/publicBoardWriter.service'

type NewsletterBoardWriterPanelProps = {
  board: NewsletterBoard
  token: string
  role: string
  busy: boolean
  onBusyChange: (busy: boolean) => void
}

export function NewsletterBoardWriterPanel({
  board,
  token,
  role,
  busy,
  onBusyChange,
}: NewsletterBoardWriterPanelProps) {
  const [writers, setWriters] = useState<PublicBoardWriterAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loginIdChecked, setLoginIdChecked] = useState(false)
  const [loginIdAvailable, setLoginIdAvailable] = useState<boolean | null>(null)
  const [checkMessage, setCheckMessage] = useState('')
  const [error, setError] = useState('')
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({})

  const loadWriters = useCallback(async () => {
    if (!token.trim()) {
      setWriters([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setWriters(await listBoardWriterAccountsForBoard(token, role, board.id))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '작성자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [board.id, role, token])

  useEffect(() => {
    void loadWriters()
  }, [loadWriters])

  useEffect(() => {
    setLoginId('')
    setPassword('')
    setDisplayName('')
    setLoginIdChecked(false)
    setLoginIdAvailable(null)
    setCheckMessage('')
    setError('')
    setResetPasswordById({})
  }, [board.id])

  const handleLoginIdChange = (value: string) => {
    setLoginId(value)
    setLoginIdChecked(false)
    setLoginIdAvailable(null)
    setCheckMessage('')
  }

  const handleCheckLoginId = () => {
    if (!token.trim() || busy || !loginId.trim()) {
      return
    }
    void (async () => {
      onBusyChange(true)
      setError('')
      try {
        const result = await checkBoardWriterLoginId(token, role, board.id, loginId.trim())
        setLoginIdChecked(true)
        setLoginIdAvailable(result.available)
        setCheckMessage(
          result.available ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.',
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : '아이디 중복 확인에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleCreate = () => {
    if (!token.trim() || busy || !loginIdChecked || !loginIdAvailable || !password.trim()) {
      return
    }
    void (async () => {
      onBusyChange(true)
      setError('')
      try {
        await createBoardWriterAccountForBoard(token, role, board.id, {
          loginId: loginId.trim(),
          password,
          displayName: displayName.trim() || loginId.trim(),
        })
        setLoginId('')
        setPassword('')
        setDisplayName('')
        setLoginIdChecked(false)
        setLoginIdAvailable(null)
        setCheckMessage('')
        await loadWriters()
      } catch (e) {
        setError(e instanceof Error ? e.message : '작성자 계정 생성에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleResetPassword = (accountId: string) => {
    const nextPassword = resetPasswordById[accountId]?.trim() ?? ''
    if (!nextPassword || nextPassword.length < 8 || busy) {
      return
    }
    void (async () => {
      onBusyChange(true)
      setError('')
      try {
        await resetBoardWriterAccountPassword(token, role, board.id, accountId, nextPassword)
        setResetPasswordById((prev) => ({ ...prev, [accountId]: '' }))
        await loadWriters()
      } catch (e) {
        setError(e instanceof Error ? e.message : '비밀번호 초기화에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleToggleStatus = (writer: PublicBoardWriterAccount) => {
    if (busy) {
      return
    }
    void (async () => {
      onBusyChange(true)
      setError('')
      try {
        await setBoardWriterAccountStatus(token, role, board.id, writer.id, !writer.isActive)
        await loadWriters()
      } catch (e) {
        setError(e instanceof Error ? e.message : '계정 상태 변경에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const canCreate =
    loginId.trim().length >= 3 &&
    password.length >= 8 &&
    loginIdChecked &&
    loginIdAvailable === true &&
    !busy

  return (
    <div className="newsletter-board-admin-page__writer-panel">
      <header className="newsletter-board-admin-page__writer-panel-head">
        <div>
          <h3>{board.label}</h3>
          <p className="newsletter-board-admin-page__writer-panel-path">
            경로: /portal/boards/{board.slug}
          </p>
        </div>
      </header>

      <section className="newsletter-board-admin-page__writer-panel-section">
        <h4>작성자 계정 추가</h4>
        <div className="newsletter-board-admin-page__writer-form-grid">
          <label className="form-field">
            <span className="form-label">아이디</span>
            <div className="newsletter-board-admin-page__writer-inline">
              <FormInput value={loginId} onChange={(event) => handleLoginIdChange(event.target.value)} />
              <FormButton
                htmlType="button"
                variant="secondary"
                disabled={busy || !loginId.trim()}
                onClick={handleCheckLoginId}
              >
                중복 확인
              </FormButton>
            </div>
            {checkMessage ? (
              <span
                className={
                  loginIdAvailable
                    ? 'newsletter-board-admin-page__writer-check newsletter-board-admin-page__writer-check--ok'
                    : 'newsletter-board-admin-page__writer-check newsletter-board-admin-page__writer-check--bad'
                }
              >
                {checkMessage}
              </span>
            ) : null}
          </label>
          <label className="form-field">
            <span className="form-label">비밀번호</span>
            <FormInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">표시명</span>
            <FormInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        </div>
        <FormButton htmlType="button" variant="primary" disabled={!canCreate} onClick={handleCreate}>
          작성자 계정 생성
        </FormButton>
      </section>

      <section className="newsletter-board-admin-page__writer-panel-section">
        <h4>등록된 작성자 계정</h4>
        {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
        {!loading && writers.length === 0 ? (
          <div className="insurer-news-empty">등록된 작성자 계정이 없습니다.</div>
        ) : null}
        {!loading && writers.length > 0 ? (
          <div className="newsletter-board-admin-page__writer-table-wrap">
            <table className="newsletter-board-admin-page__writer-table">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>표시명</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {writers.map((writer) => (
                  <tr key={writer.id}>
                    <td>{writer.loginId}</td>
                    <td>{writer.name}</td>
                    <td>{writer.isActive ? '활성' : '비활성'}</td>
                    <td>
                      <div className="newsletter-board-admin-page__writer-actions">
                        <FormInput
                          type="password"
                          placeholder="새 비밀번호"
                          value={resetPasswordById[writer.id] ?? ''}
                          onChange={(event) =>
                            setResetPasswordById((prev) => ({
                              ...prev,
                              [writer.id]: event.target.value,
                            }))
                          }
                        />
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          disabled={busy || (resetPasswordById[writer.id]?.length ?? 0) < 8}
                          onClick={() => handleResetPassword(writer.id)}
                        >
                          비밀번호 초기화
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => handleToggleStatus(writer)}
                        >
                          {writer.isActive ? '비활성화' : '활성화'}
                        </FormButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  )
}
