import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import {
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getPublicBoardWriterToken()
    if (!token?.trim()) {
      navigate('/board-writer/login', { replace: true })
      return
    }
    void (async () => {
      try {
        const me = await fetchPublicBoardWriterMe(token)
        const rows = await listPublicBoardWriterBoards(token)
        setWriterName(me.name || me.loginId)
        setBoards(rows)
        setError('')
        if (rows.length === 1) {
          navigate(`/board-writer/boards/${encodeURIComponent(rows[0].slug)}/news`, { replace: true })
          return
        }
      } catch {
        setPublicBoardWriterToken(null)
        navigate('/board-writer/login', { replace: true })
      } finally {
        setLoading(false)
      }
    })()
  }, [navigate])

  const handleLogout = () => {
    setPublicBoardWriterToken(null)
    navigate('/board-writer/login', { replace: true })
  }

  if (loading) {
    return (
      <main className="page public-board-writer-workspace-page user-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  return (
    <main className="page public-board-writer-workspace-page user-page">
      <div className="public-board-writer-workspace">
        <section className="public-board-writer-card">
          <h1>소식지 작성</h1>
          <p>{writerName ? `${writerName} 님` : '작성자'} — 할당된 소식지를 선택해 글을 작성합니다.</p>
          <FormButton htmlType="button" variant="secondary" onClick={handleLogout}>
            로그아웃
          </FormButton>
        </section>
        {error ? <p className="status status--error">{error}</p> : null}
        {boards.length === 0 ? (
          <div className="insurer-news-empty">
            작성 가능한 공용 소식지가 없습니다.
            <br />
            관리자에게 소식지 권한을 요청해 주세요.
          </div>
        ) : null}
        {boards.map((board) => (
          <section key={board.id} className="public-board-writer-board-item">
            <h3>{board.label}</h3>
            <p className="insurer-news-muted" style={{ marginTop: 0 }}>
              {board.boardScope === 'global' ? '공용 소식지' : 'GA전용 소식지'}
            </p>
            <Link
              className="button button--primary"
              to={`/board-writer/boards/${encodeURIComponent(board.slug)}/news`}
            >
              소식지 열기
            </Link>
          </section>
        ))}
      </div>
    </main>
  )
}
