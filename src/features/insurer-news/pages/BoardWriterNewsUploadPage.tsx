import { useEffect } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import {
  createBoardWriterNewsletter,
  getPublicBoardWriterToken,
  uploadBoardWriterAttachments,
} from '../services/publicBoardWriter.service'
import type { BoardWriterOutletContext } from './BoardWriterWorkspaceLayout'

export function BoardWriterNewsUploadPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const { board, uploadLabel } = useOutletContext<BoardWriterOutletContext>()
  const navigate = useNavigate()
  const writerToken = getPublicBoardWriterToken()?.trim() ?? ''

  useEffect(() => {
    if (!writerToken) {
      navigate('/board-writer/login', { replace: true })
    }
  }, [navigate, writerToken])

  if (!writerToken || !boardSlug.trim() || board.slug !== boardSlug) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  const listPath = `/board-writer/boards/${encodeURIComponent(boardSlug)}/news`
  const companySlug = `board-${boardSlug}`

  return (
    <main className="page page--with-back insurer-news-page user-page">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>{uploadLabel}</h1>
        <p className="insurer-news-muted">첨부 파일과 본문을 입력한 뒤 저장합니다.</p>
      </header>
      <InsurerNewsForm
        mode="create"
        initial={null}
        context={{
          gaCode: 'GLOBAL',
          insurerCode: 'BOARD',
          insurerName: board.label || '소식지',
          insurerSlug: companySlug,
        }}
        authToken={writerToken}
        enableLinkPreview
        linkPreviewEndpoint="/api/board-writer/link-preview"
        enableAutoLinking
        enablePhoneLinks
        uploadAttachments={(authToken, drafts) => uploadBoardWriterAttachments(authToken, boardSlug, drafts)}
        onCancel={() => navigate(listPath)}
        onSubmit={async (draft) => {
          await createBoardWriterNewsletter(writerToken, boardSlug, draft)
          navigate(listPath)
        }}
      />
    </main>
  )
}
