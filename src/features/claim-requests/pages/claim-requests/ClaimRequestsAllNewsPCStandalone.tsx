import { useCallback, useEffect, useMemo, useState } from 'react'
import FileUploader from '../../../../components/common/FileUploader'
import { StatusMessage } from '../../../../components/feedback'
import { FormButton, FormInput, FormTextarea } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { useInsurerNewsForm } from '../../../insurer-news/hooks/useInsurerNewsForm'
import { uploadNewsletterAttachments } from '../../../insurer-news/services/insurerNews.service'
import type { LocalAttachmentDraft } from '../../../insurer-news/types'
import { validateInsurerNewsFile } from '../../../insurer-news/utils/validateInsurerNewsFile'
import { createCustomerNews, listAgentCustomerNews, type AgentCustomerNewsItem } from '../../api/claimRequestsApi'
import './ClaimRequestsAllNewsPCStandalone.css'

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function firstImageUrl(item: AgentCustomerNewsItem | null | undefined): string {
  if (!item) return ''
  const image = item.attachments?.find((attachment) => attachment.kind === 'image')
  return String(item.heroImageUrl || image?.url || '').trim()
}

function imageCount(item: AgentCustomerNewsItem): number {
  return item.attachments?.filter((attachment) => attachment.kind === 'image').length ?? (item.heroImageUrl ? 1 : 0)
}

function useAttachmentPreviewUrls(attachments: LocalAttachmentDraft[]) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const nextUrls = attachments
      .filter((attachment) => attachment.file.type.startsWith('image/'))
      .map((attachment) => URL.createObjectURL(attachment.file))
    setUrls(nextUrls)
    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments])

  return urls
}

export default function ClaimRequestsAllNewsPCStandalone() {
  const { token } = useAuth()
  const form = useInsurerNewsForm(null)
  const draftPreviewUrls = useAttachmentPreviewUrls(form.attachments)
  const [messages, setMessages] = useState<AgentCustomerNewsItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadBusyText, setUploadBusyText] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [previewIndex, setPreviewIndex] = useState(0)

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedId) ?? messages[0] ?? null,
    [messages, selectedId],
  )

  const savedPreviewImages = useMemo(() => {
    if (!selectedMessage) return []
    const attachmentImages = selectedMessage.attachments
      ?.filter((attachment) => attachment.kind === 'image' && attachment.url)
      .map((attachment) => attachment.url) ?? []
    const hero = firstImageUrl(selectedMessage)
    return Array.from(new Set([hero, ...attachmentImages].filter(Boolean)))
  }, [selectedMessage])

  const previewImages = draftPreviewUrls.length > 0 ? draftPreviewUrls : savedPreviewImages
  const activePreviewImage = previewImages[previewIndex] ?? ''

  useEffect(() => {
    setPreviewIndex(0)
  }, [draftPreviewUrls.length, selectedMessage?.id])

  const loadMessages = useCallback(async () => {
    if (!token?.trim()) {
      setMessages([])
      setSelectedId(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listAgentCustomerNews(token, { scope: 'all' })
      setMessages(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((item) => item.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (loadError) {
      setMessages([])
      setSelectedId(null)
      setError(loadError instanceof Error ? loadError.message : '고객메시지를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const validateImageFile = useCallback((file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return '고객앱 메인 고객메시지는 이미지 파일만 등록할 수 있습니다.'
    }
    const validated = validateInsurerNewsFile(file)
    return validated.ok ? null : validated.message
  }, [])

  const movePreview = (direction: 'prev' | 'next') => {
    if (previewImages.length <= 1) return
    setPreviewIndex((prev) => {
      if (direction === 'prev') return prev <= 0 ? previewImages.length - 1 : prev - 1
      return prev >= previewImages.length - 1 ? 0 : prev + 1
    })
  }

  const handleSend = async () => {
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    if (form.attachments.length === 0) {
      setError('고객앱 홈에 표시할 이미지를 먼저 업로드해 주세요.')
      return
    }
    setBusy(true)
    setNotice('')
    setError('')
    setUploadBusyText('이미지 업로드 중...')
    try {
      const uploaded = await uploadNewsletterAttachments(token, form.attachments, {
        presignInsurerCode: 'CUSTOMER_NEWS',
      })
      form.replaceAttachments(uploaded)
      if (uploaded.some((row) => row.status === 'failed')) {
        setError('일부 이미지 업로드에 실패했습니다. 실패 항목을 정리하고 다시 시도해 주세요.')
        return
      }
      const attachments = uploaded
        .filter((row): row is LocalAttachmentDraft & { cdnUrl: string; objectKey: string } => Boolean(row.cdnUrl && row.objectKey))
        .map((row, index) => ({
          kind: 'image' as const,
          url: row.cdnUrl,
          objectKey: row.objectKey,
          fileName: row.file.name,
          mimeType: row.mimeType ?? row.file.type ?? 'image/jpeg',
          size: row.sizeBytes ?? row.file.size,
          sortOrder: index,
        }))
      if (attachments.length === 0) {
        setError('저장할 이미지가 없습니다.')
        return
      }
      setUploadBusyText('고객메시지 저장 중...')
      const messageTitle = title.trim() || '고객메시지'
      const content = description.trim() || messageTitle
      const created = await createCustomerNews(token, {
        title: messageTitle,
        content,
        scope: 'all',
        sendPush: true,
        attachments,
      })
      setNotice('고객앱 메인 고객메시지를 저장했습니다.')
      setTitle('')
      setDescription('')
      form.setBodyText('')
      form.replaceAttachments([])
      await loadMessages()
      setSelectedId(created.id)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '고객메시지 저장에 실패했습니다.')
    } finally {
      setUploadBusyText(null)
      setBusy(false)
    }
  }

  return (
    <section className="customer-message-workspace" aria-label="고객메시지 이미지 업로드">
      <div className="customer-message-phone-zone">
        <div className="customer-message-phone">
          <div className="customer-message-phone__speaker" />
          <div className="customer-message-phone__screen">
            <header className="customer-message-phone__header">
              <div className="customer-message-phone__identity">
                <span>담당자</span>
                <strong>김진우</strong>
                <small>· 010-0000-0000</small>
              </div>
              <div className="customer-message-phone__actions">
                <span>전화하기</span>
                <span>닫기</span>
              </div>
            </header>

            <main className="customer-message-phone__main">
              <div className="customer-message-phone__slide">
                {activePreviewImage ? (
                  <img src={activePreviewImage} alt="고객앱 고객메시지 미리보기" />
                ) : (
                  <div className="customer-message-phone__empty">
                    이미지를 업로드하면 고객앱 홈 미리보기가 여기에 표시됩니다.
                  </div>
                )}
              </div>
              {previewImages.length > 1 ? (
                <div className="customer-message-phone__controls">
                  <button type="button" onClick={() => movePreview('prev')}>이전</button>
                  <span>{previewIndex + 1} / {previewImages.length}</span>
                  <button type="button" onClick={() => movePreview('next')}>다음</button>
                </div>
              ) : null}
            </main>

            <footer className="customer-message-phone__bottom">
              <button type="button">청구/문의하기</button>
              <nav>
                <span className="is-active">홈</span>
                <span>문의내역</span>
                <span>개인메시지</span>
                <span>내정보</span>
              </nav>
            </footer>
          </div>
        </div>
      </div>

      <div className="customer-message-editor-zone">
        <header className="customer-message-editor__header">
          <div>
            <h3>고객메시지 이미지 업로드</h3>
            <p>이미지를 올리면 고객앱 홈 화면 세로 슬라이드에 자동 적용됩니다.</p>
          </div>
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void loadMessages()} loading={loading}>
            새로고침
          </FormButton>
        </header>

        <div className="customer-message-editor__grid">
          <section className="customer-message-editor__card">
            <h4>새 고객메시지</h4>
            <FormInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="제목: 예) 5월 고객 안내"
              disabled={busy}
            />
            <FormTextarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="설명 문구를 입력하세요. 비워도 저장됩니다."
              disabled={busy}
            />
            <FileUploader
              accept="image/*"
              validateFile={validateImageFile}
              onFiles={form.addAttachments}
              onInvalidBatch={(failures) => setError(failures[0]?.message ?? '첨부할 수 없는 이미지가 있습니다.')}
              multiple
              compact
              disabled={busy}
              statusText={uploadBusyText ?? undefined}
              primaryHint="이미지 업로드"
              hintLines={['권장 비율: 세로형 9:16, 여러 장 등록 시 슬라이드로 표시됩니다.']}
            />
            {form.attachments.length > 0 ? (
              <div className="customer-message-draft-list">
                {form.attachments.map((attachment) => (
                  <div key={attachment.localId} className="customer-message-draft-list__item">
                    <span>{attachment.file.name}</span>
                    <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => form.removeAttachment(attachment.localId)} disabled={busy}>
                      삭제
                    </FormButton>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="customer-message-editor__footer">
              <StatusMessage message={notice} />
              <StatusMessage message={error} tone="error" />
              <FormButton htmlType="button" variant="primary" onClick={() => void handleSend()} loading={busy} disabled={busy}>
                고객앱에 적용
              </FormButton>
            </div>
          </section>

          <section className="customer-message-editor__card customer-message-editor__card--history">
            <h4>등록된 고객메시지</h4>
            {loading ? <div className="customer-message-history-empty">불러오는 중…</div> : null}
            {!loading && messages.length === 0 ? <div className="customer-message-history-empty">등록된 고객메시지가 없습니다.</div> : null}
            <div className="customer-message-history-list">
              {messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className={`customer-message-history-item${selectedMessage?.id === message.id ? ' customer-message-history-item--active' : ''}`}
                  onClick={() => setSelectedId(message.id)}
                >
                  {firstImageUrl(message) ? <img src={firstImageUrl(message)} alt="" /> : <div className="customer-message-history-item__thumb" />}
                  <span>
                    <strong>{message.title || '고객메시지'}</strong>
                    <small>{formatDateTime(message.updatedAt)} · 이미지 {imageCount(message)}장</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
