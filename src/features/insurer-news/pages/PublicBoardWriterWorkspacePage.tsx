import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import {
  createPublicBoardWriterPost,
  fetchPublicBoardWriterMe,
  getPublicBoardWriterToken,
  listPublicBoardWriterBoards,
  setPublicBoardWriterToken,
  type PublicBoardWriterBoard,
} from '../services/publicBoardWriter.service'
import './public-board-writer.css'

export function PublicBoardWriterWorkspacePage() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<PublicBoardWriterBoard[]>([])
  const [writerName, setWriterName] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busySlug, setBusySlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getPublicBoardWriterToken()
    if (!token?.trim()) {
      navigate('/public-board-writer/login', { replace: true })
      return
    }
    void (async () => {
      try {
        const me = await fetchPublicBoardWriterMe(token)
        setWriterName(me.name || me.loginId)
        setBoards(await listPublicBoardWriterBoards(token))
        setError('')
      } catch {
        setPublicBoardWriterToken(null)
        navigate('/public-board-writer/login', { replace: true })
      }
    })()
  }, [navigate])

  const handlePublish = (board: PublicBoardWriterBoard) => {
    const token = getPublicBoardWriterToken()
    const bodyText = (drafts[board.slug] ?? '').trim()
    if (!token || !bodyText || busySlug) {
      return
    }
    void (async () => {
      setBusySlug(board.slug)
      setError('')
      try {
        await createPublicBoardWriterPost(token, board.slug, bodyText)
        setDrafts((prev) => ({ ...prev, [board.slug]: '' }))
      } catch (e) {
        setError(e instanceof Error ? e.message : '게시글 저장에 실패했습니다.')
      } finally {
        setBusySlug('')
      }
    })()
  }

  const handleLogout = () => {
    setPublicBoardWriterToken(null)
    navigate('/public-board-writer/login', { replace: true })
  }

  return (
    <main className="page public-board-writer-workspace-page user-page">
      <div className="public-board-writer-workspace">
        <section className="public-board-writer-card">
          <h1>공용 게시판 작성</h1>
          <p>{writerName ? `${writerName} 님` : '작성자'} — 전체 공용 게시판만 작성할 수 있습니다.</p>
          <FormButton htmlType="button" variant="secondary" onClick={handleLogout}>
            로그아웃
          </FormButton>
        </section>
        {error ? <p className="status status--error">{error}</p> : null}
        {boards.length === 0 ? <div className="insurer-news-empty">작성 가능한 공용 게시판이 없습니다.</div> : null}
        {boards.map((board) => (
          <section key={board.id} className="public-board-writer-board-item">
            <h3>{board.label}</h3>
            <textarea
              className="form-input"
              rows={5}
              placeholder="공용 게시글 내용"
              value={drafts[board.slug] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [board.slug]: e.target.value }))}
            />
            <FormButton
              htmlType="button"
              variant="primary"
              disabled={busySlug === board.slug || !(drafts[board.slug] ?? '').trim()}
              onClick={() => handlePublish(board)}
            >
              {busySlug === board.slug ? '게시 중...' : '게시'}
            </FormButton>
          </section>
        ))}
      </div>
    </main>
  )
}
