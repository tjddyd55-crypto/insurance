import { useInsurerNewsForm } from '../hooks/useInsurerNewsForm'
import type { LocalAttachmentDraft, NewsletterDetail } from '../types'
import { InsurerNewsUploadDropzone } from './InsurerNewsUploadDropzone'

const statusLabel: Record<string, string> = {
  pending: '대기',
  uploading: '업로드 중',
  completed: '완료',
  failed: '실패',
}

type Props = {
  mode: 'create' | 'edit'
  initial: NewsletterDetail | null
  onSubmit: (draft: NewsletterDetail) => void | Promise<void>
  onCancel: () => void
  /** GA/원수사 컨텍스트 — 저장 시 NewsletterDetail 에 주입 */
  context: {
    gaCode: string
    insurerCode: string
    insurerName: string
    insurerSlug: string
  }
  /** 수정 시 기존 id / 신규 시 undefined → 내부에서 생성 */
  newsletterId?: string
}

function buildDraft(
  id: string,
  ctx: Props['context'],
  title: string,
  bodyText: string,
  attachmentItems: LocalAttachmentDraft[],
): NewsletterDetail {
  const summary =
    bodyText.trim().slice(0, 160) || title.trim().slice(0, 160) || '요약 없음'
  const images = attachmentItems.filter((a) => a.kind === 'image' && a.status !== 'failed')
  const pdfs = attachmentItems.filter((a) => a.kind === 'pdf' && a.status !== 'failed')
  const attachments = attachmentItems
    .filter((a) => a.status !== 'failed')
    .map((a, i) => {
      if (a.existingAttachmentId && a.previewUrl && a.kind === 'image') {
        return {
          id: a.existingAttachmentId,
          kind: 'image' as const,
          url: a.previewUrl,
          fileName: a.file.name || `image-${i}.webp`,
          sortOrder: i,
        }
      }
      if (a.existingAttachmentId && a.kind === 'pdf') {
        return {
          id: a.existingAttachmentId,
          kind: 'pdf' as const,
          url: '#',
          fileName: a.file.name || `file-${i}.pdf`,
          sortOrder: i,
        }
      }
      if (a.kind === 'image' && a.previewUrl) {
        return {
          id: a.localId,
          kind: 'image' as const,
          url: a.previewUrl,
          fileName: a.file.name,
          sortOrder: i,
        }
      }
      return {
        id: a.localId,
        kind: 'pdf' as const,
        url: '#',
        fileName: a.file.name,
        sortOrder: i,
      }
    })

  const heroImageUrl = images[0]?.previewUrl ?? null

  return {
    id,
    gaCode: ctx.gaCode,
    insurerCode: ctx.insurerCode,
    insurerName: ctx.insurerName,
    insurerSlug: ctx.insurerSlug,
    title: title.trim(),
    summary,
    heroImageUrl,
    publishedAt: new Date().toISOString(),
    status: 'PUBLISHED',
    hasImages: images.length > 0,
    hasPdf: pdfs.length > 0,
    hasTextBody: bodyText.trim().length > 0,
    bodyText: bodyText.trim(),
    attachments,
  }
}

export function InsurerNewsForm({ mode, initial, onSubmit, onCancel, context, newsletterId }: Props) {
  const form = useInsurerNewsForm(initial)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id =
      newsletterId ??
      initial?.id ??
      `nl-${context.gaCode.toLowerCase()}-${context.insurerCode.toLowerCase()}-${Date.now()}`
    const draft = buildDraft(id, context, form.title, form.bodyText, form.attachments)
    await onSubmit(draft)
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="auth-card card" style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0, fontSize: '1.25rem' }}>{mode === 'create' ? '새 소식지' : '소식지 수정'}</h1>

      <label className="field">
        <span className="field__label">제목</span>
        <input
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          required
          className="admin-form-input"
          placeholder="제목을 입력하세요"
        />
      </label>

      <label className="field">
        <span className="field__label">내용</span>
        <textarea
          value={form.bodyText}
          onChange={(e) => form.setBodyText(e.target.value)}
          rows={8}
          className="admin-form-input"
          style={{ height: 'auto', minHeight: 160, paddingTop: 12, paddingBottom: 12 }}
          placeholder="본문을 입력하세요"
        />
      </label>

      <div className="field">
        <span className="field__label">파일</span>
        <InsurerNewsUploadDropzone onFiles={form.addAttachments} />
        <div className="insurer-news-upload-list">
          {form.attachments.map((row) => (
            <div key={row.localId} className="insurer-news-upload-row">
              {row.kind === 'image' && row.previewUrl ? (
                <img className="insurer-news-upload-row__thumb" src={row.previewUrl} alt="" />
              ) : (
                <div className="insurer-news-upload-row__pdf">PDF</div>
              )}
              <div className="insurer-news-upload-row__info">
                <p className="insurer-news-upload-row__name">{row.file.name || '(이름 없음)'}</p>
                <p
                  className={`insurer-news-upload-row__status${row.status === 'failed' ? ' insurer-news-upload-row__status--err' : ''}`}
                >
                  {statusLabel[row.status] ?? row.status}
                  {row.errorMessage ? ` — ${row.errorMessage}` : ''}
                </p>
              </div>
              <button type="button" className="button button--secondary" onClick={() => form.removeAttachment(row.localId)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="button button--primary">
          {mode === 'create' ? '등록' : '저장'}
        </button>
      </div>
    </form>
  )
}
