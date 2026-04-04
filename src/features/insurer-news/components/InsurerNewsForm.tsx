import { useState } from 'react'
import { useInsurerNewsForm } from '../hooks/useInsurerNewsForm'
import type { LocalAttachmentDraft, NewsletterDetail } from '../types'
import { uploadNewsletterAttachments } from '../services/insurerNews.service'
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
  /** 저장 전 R2 업로드 후 CDN URL 기준으로 저장 */
  authToken: string | null
}

/** API 저장용 — 반드시 cdnUrl + objectKey (미리보기 blob 금지) */
function buildDraftForApi(
  id: string,
  ctx: Props['context'],
  title: string,
  bodyText: string,
  attachmentItems: LocalAttachmentDraft[],
  initial: NewsletterDetail | null,
): NewsletterDetail {
  const summary =
    bodyText.trim().slice(0, 160) || title.trim().slice(0, 160) || '요약 없음'
  const ok = attachmentItems.filter((a) => a.status !== 'failed')
  const images = ok.filter((a) => a.kind === 'image')
  const pdfs = ok.filter((a) => a.kind === 'pdf')

  const attachments = ok.map((a, i) => {
    const url = a.cdnUrl ?? ''
    const objectKey = a.objectKey ?? ''
    const mimeType =
      a.mimeType ?? (a.kind === 'pdf' ? 'application/pdf' : a.file.type || 'application/octet-stream')
    const size = a.sizeBytes ?? a.file.size
    if (!url || !objectKey) {
      throw new Error('첨부 업로드 정보가 없습니다. 다시 시도해 주세요.')
    }
    return {
      id: a.existingAttachmentId ?? a.localId,
      kind: a.kind,
      url,
      objectKey,
      fileName: a.file.name || (a.kind === 'pdf' ? `file-${i}.pdf` : `image-${i}.webp`),
      mimeType,
      size,
      sortOrder: i,
    }
  })

  const heroImageUrl = images[0]?.cdnUrl ?? null

  return {
    id,
    gaCode: ctx.gaCode,
    insurerCode: ctx.insurerCode,
    insurerName: ctx.insurerName,
    insurerSlug: ctx.insurerSlug,
    title: title.trim(),
    summary,
    heroImageUrl,
    publishedAt: initial?.publishedAt ?? new Date().toISOString(),
    status: initial?.status ?? 'PUBLISHED',
    hasImages: images.length > 0,
    hasPdf: pdfs.length > 0,
    hasTextBody: bodyText.trim().length > 0,
    bodyText: bodyText.trim(),
    attachments,
  }
}

export function InsurerNewsForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  context,
  newsletterId,
  authToken,
}: Props) {
  const form = useInsurerNewsForm(initial)
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    const id =
      newsletterId ??
      initial?.id ??
      `nl-${context.gaCode.toLowerCase()}-${context.insurerCode.toLowerCase()}-${Date.now()}`

    if (!authToken?.trim()) {
      setSubmitError('로그인이 필요합니다.')
      return
    }
    const uploaded = await uploadNewsletterAttachments(authToken, form.attachments, {
      presignInsurerCode: context.insurerCode,
    })
    form.replaceAttachments(uploaded)
    if (uploaded.some((a) => a.status === 'failed')) {
      setSubmitError('일부 파일 업로드에 실패했습니다. 실패한 항목을 확인한 뒤 다시 시도해 주세요.')
      return
    }
    try {
      const draft = buildDraftForApi(id, context, form.title, form.bodyText, uploaded, initial)
      await onSubmit(draft)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장에 실패했습니다.'
      setSubmitError(msg)
    }
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

      {submitError ? (
        <p className="insurer-news-upload-row__status insurer-news-upload-row__status--err" style={{ marginBottom: 12 }}>
          {submitError}
        </p>
      ) : null}

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
