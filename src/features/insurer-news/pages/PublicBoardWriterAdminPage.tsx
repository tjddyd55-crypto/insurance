import { useCallback, useEffect, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listAdminNewsletterBoards } from '../services/insurerNews.service'
import {
  createAdminPublicBoardWriter,
  listAdminPublicBoardWriters,
  type PublicBoardWriterAccount,
} from '../services/publicBoardWriter.service'
import type { NewsletterBoard } from '../types'
import './public-board-writer.css'

export function PublicBoardWriterAdminPage() {
  const { token, user } = useAuth()
  const [writers, setWriters] = useState<PublicBoardWriterAccount[]>([])
  const [boards, setBoards] = useState<NewsletterBoard[]>([])
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canManage = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    if (!token?.trim() || !canManage) {
      return
    }
    try {
      const [writerRows, boardRows] = await Promise.all([
        listAdminPublicBoardWriters(token),
        listAdminNewsletterBoards(token),
      ])
      setWriters(writerRows)
      const globalBoards = boardRows.filter((b) => b.boardScope === 'global' || b.contentScope === 'global' || b.isPublic)
      setBoards(globalBoards)
      setSelectedBoardIds((prev) => prev.filter((id) => globalBoards.some((b) => b.id === id)))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [canManage, token])

  useEffect(() => {
    void load()
  }, [load])

  const toggleBoard = (boardId: string, checked: boolean) => {
    setSelectedBoardIds((prev) => {
      if (checked) {
        return prev.includes(boardId) ? prev : [...prev, boardId]
      }
      return prev.filter((id) => id !== boardId)
    })
  }

  const handleCreate = () => {
    if (!token?.trim() || busy) {
      return
    }
    if (selectedBoardIds.length === 0) {
      setError('작성 권한을 부여할 공용 소식지를 1개 이상 선택해 주세요.')
      return
    }
    void (async () => {
      setBusy(true)
      setError('')
      try {
        await createAdminPublicBoardWriter(token, {
          loginId: loginId.trim(),
          password,
          name: name.trim() || loginId.trim(),
          allowedBoardIds: selectedBoardIds,
        })
        setLoginId('')
        setPassword('')
        setName('')
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : '계정 생성에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  if (!canManage) {
    return (
      <main className="page user-page">
        <div className="insurer-news-empty">공용 작성자 계정 관리 권한이 없습니다.</div>
      </main>
    )
  }

  return (
    <main className="page user-page">
      <div className="public-board-writer-workspace">
        <section className="public-board-writer-card">
          <h1>공용 작성자 계정 관리</h1>
          <p>공용 소식지 글 작성 전용 계정을 생성합니다. 일반 GA 사용자와 분리됩니다.</p>
        </section>
        <section className="public-board-writer-card">
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>계정 생성</h2>
          <label className="form-field">
            <span className="form-label">이름</span>
            <FormInput value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">아이디</span>
            <FormInput value={loginId} onChange={(e) => setLoginId(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">비밀번호</span>
            <FormInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="form-field">
            <span className="form-label">작성 가능 소식지</span>
            {boards.length === 0 ? (
              <p className="insurer-news-muted">등록된 공용 소식지가 없습니다. 먼저 공용 소식지를 추가해 주세요.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {boards.map((board) => (
                  <li key={board.id} style={{ marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={selectedBoardIds.includes(board.id)}
                        onChange={(e) => toggleBoard(board.id, e.target.checked)}
                      />
                      <span>{board.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <FormButton htmlType="button" variant="primary" disabled={busy} onClick={handleCreate}>
            계정 생성
          </FormButton>
          {error ? <p className="status status--error">{error}</p> : null}
        </section>
        <section className="public-board-writer-card">
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>등록된 계정</h2>
          {writers.length === 0 ? <div className="insurer-news-empty">등록된 계정이 없습니다.</div> : null}
          <ul>
            {writers.map((w) => (
              <li key={w.id}>
                {w.name} ({w.loginId}) — {w.isActive ? '활성' : '비활성'}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
