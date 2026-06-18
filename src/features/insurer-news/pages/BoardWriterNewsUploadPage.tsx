import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import {
  createBoardWriterNewsletter,
  getPublicBoardWriterToken,
  listPublicBoardWriterBoards,
  setPublicBoardWriterToken,
  uploadBoardWriterAttachments,
} from '../services/publicBoardWriter.service'

export function BoardWriterNewsUploadPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const [boardLabel, setBoardLabel] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const writerToken = getPublicBoardWriterToken()
    if (!writerToken?.trim()) {
      navigate('/board-writer/login', { replace: true })
      return
    }
    if (!boardSlug.trim()) {
      navigate('/board-writer/workspace', { replace: true })
      return
    }
    setToken(writerToken)
    void (async () => {
      try {
        const boards = await listPublicBoardWriterBoards(writerToken)
        const board = boards.find((row) => row.slug === boardSlug)
        if (!board) {
          setError('작성 권한이 없는 소식지입니다.')
          return
        }
        setBoardLabel(board.label)
      } catch {
        setPublicBoardWriterToken(null)
        navigate('/board-writer/login', { replace: true })
      }
    })()
  }, [boardSlug, navigate])

  if (!token) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <div className="insurer-news-empty">{error}</div>
      </main>
    )
  }

  const listPath = `/board-writer/boards/${encodeURIComponent(boardSlug)}/news`
  const companySlug = `board-${boardSlug}`

  return (
    <main className="page page--with-back insurer-news-page user-page">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>{boardLabel || '소식지'} 업로드</h1>
        <p className="insurer-news-muted">첨부 파일과 본문을 입력한 뒤 저장합니다.</p>
      </header>
      <InsurerNewsForm
        mode="create"
        initial={null}
        context={{
          gaCode: 'GLOBAL',
          insurerCode: 'BOARD',
          insurerName: boardLabel || '소식지',
          insurerSlug: companySlug,
        }}
        authToken={token}
        uploadAttachments={(authToken, drafts) => uploadBoardWriterAttachments(authToken, boardSlug, drafts)}
        onCancel={() => navigate(listPath)}
        onSubmit={async (draft) => {
          await createBoardWriterNewsletter(token, boardSlug, draft)
          navigate(listPath)
        }}
      />
    </main>
  )
}
