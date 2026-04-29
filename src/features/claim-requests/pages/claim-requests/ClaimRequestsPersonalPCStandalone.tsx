import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import FileUploader from '../../../../components/common/FileUploader'
import { FormButton, FormTextarea } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { uploadNewsletterAttachments } from '../../../insurer-news/services/insurerNews.service'
import type { LocalAttachmentDraft } from '../../../insurer-news/types'
import { useInsurerNewsForm } from '../../../insurer-news/hooks/useInsurerNewsForm'
import { validateInsurerNewsFile } from '../../../insurer-news/utils/validateInsurerNewsFile'
import {
  createCustomerNews,
  listAgentCustomerNews,
  type AgentCustomerNewsItem,
} from '../../api/claimRequestsApi'
import './ClaimRequestsPersonalPCStandalone.css'

function parsePositiveInt(raw: string | null | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function attachmentLabel(item: AgentCustomerNewsItem): string {
  const count = item.attachments?.length ?? 0
  return count > 0 ? `첨부 ${count}개` : '첨부 없음'
}

function messageSnippet(content: string | null | undefined): string {
  const text = String(content ?? '').trim()
  return text || '첨부파일 메시지'
}

export default function ClaimRequestsPersonalPCStandalone() {
  const { token } = useAuth()
  const { customerId: customerIdParam } = useParams<{ customerId?: string }>()
  const [searchParams] = useSearchParams()
  const activeCustomerId = useMemo(() => {
    return parsePositiveInt(searchParams.get('customerId')) ?? parsePositiveInt(customerIdParam)
  }, [customerIdParam, searchParams])

  const [messages, setMessages] = useState<AgentCustomerNewsItem[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [uploadBusyText, setUploadBusyText] = useState<string | null>(null)
  const form = useInsurerNewsForm(null)

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedMessageId) ?? messages[0] ?? null,
    [messages, selectedMessageId],
  )
  const targetCustomerName = selectedMessage?.targetCustomerName?.trim() || (activeCustomerId ? `고객 #${activeCustomerId}` : '선택 고객')

  const loadMessages = useCallback(async () => {
    if (!token?.trim() || !activeCustomerId) {
      setMessages([])
      setSelectedMessageId(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listAgentCustomerNews(token, {
        scope: 'personal',
        targetCustomerId: activeCustomerId,
      })
      setMessages(rows)
      setSelectedMessageId((prev) => {
        if (prev && rows.some((item) => item.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (loadError) {
      setMessages([])
      setSelectedMessageId(null)
      setError(loadError instanceof Error ? loadError.message : '개인메시지를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [activeCustomerId, token])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const validateNewsletterFile = useCallback((file: File): string | null => {
    const validated = validateInsurerNewsFile(file)
    return validated.ok ? null : validated.message
  }, [])

  const handleSend = async () => {
    if (!token?.trim() || !activeCustomerId) {
      setError('고객을 먼저 선택해 주세요.')
      return
    }
    if (!form.bodyText.trim() && form.attachments.length === 0) {
      setError('메시지 내용 또는 첨부파일을 추가해 주세요.')
      return
    }
    setBusy(true)
    setNotice('')
    setError('')
    setUploadBusyText(form.attachments.length > 0 ? '파일 업로드 중...' : null)
    try {
      const uploaded = await uploadNewsletterAttachments(token, form.attachments, {
        presignInsurerCode: 'CUSTOMER_NEWS',
      })
      form.replaceAttachments(uploaded)
      if (uploaded.some((row) => row.status === 'failed')) {
        setError('일부 파일 업로드에 실패했습니다. 실패 항목을 정리하고 다시 시도해 주세요.')
        return
      }
      const attachments = uploaded
        .filter((row): row is LocalAttachmentDraft & { cdnUrl: string; objectKey: string } => Boolean(row.cdnUrl && row.objectKey))
        .map((row, index) => ({
          kind: row.kind,
          url: row.cdnUrl,
          objectKey: row.objectKey,
          fileName: row.file.name,
          mimeType: row.mimeType ?? row.file.type ?? 'application/octet-stream',
          size: row.sizeBytes ?? row.file.size,
          sortOrder: index,
        }))
      setUploadBusyText('개인메시지 발송 중...')
      const created = await createCustomerNews(token, {
        title: `${targetCustomerName} 고객님께`,
        content: form.bodyText.trim(),
        scope: 'personal',
        targetCustomerId: activeCustomerId,
        sendPush: true,
        attachments,
      })
      setNotice('개인메시지를 발송했습니다.')
      form.setBodyText('')
      form.replaceAttachments([])
      await loadMessages()
      setSelectedMessageId(created.id)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '개인메시지 발송에 실패했습니다.')
    } finally {
      setUploadBusyText(null)
      setBusy(false)
    }
  }

  return (
    <section className="personal-message-workspace" aria-label="개인메시지 작업공간">
      <aside className="personal-message-panel personal-message-panel--list" aria-label="개인메시지 목록">
        <header className="personal-message-panel__header">
          <div className="personal-message-panel__title-group">
            <h3>{targetCustomerName} 개인메시지</h3>
            <p>현재 고객에게 보낸 메시지만 표시합니다.</p>
          </div>
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void loadMessages()} loading={loading}>
            새로고침
          </FormButton>
        </header>
        <div className="personal-message-panel__body personal-message-panel__body--list">
          {loading ? <div className="personal-message-empty">불러오는 중…</div> : null}
          {!loading && messages.length === 0 ? <div className="personal-message-empty">아직 보낸 개인메시지가 없습니다.</div> : null}
          <div className="personal-message-list">
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                className={`personal-message-list__item${selectedMessage?.id === message.id ? ' personal-message-list__item--active' : ''}`}
                onClick={() => setSelectedMessageId(message.id)}
              >
                <strong>{message.title || '개인메시지'}</strong>
                <span>{messageSnippet(message.content)}</span>
                <small>{formatDateTime(message.updatedAt)} · {attachmentLabel(message)}</small>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="personal-message-panel personal-message-panel--preview" aria-label="고객앱 미리보기">
        <header className="personal-message-panel__header">
          <div className="personal-message-panel__title-group">
            <h3>고객앱 미리보기</h3>
            <p>고객에게 보이는 메시지와 첨부파일을 확인합니다.</p>
          </div>
        </header>
        <div className="personal-message-panel__body personal-message-panel__body--preview">
          {!selectedMessage ? (
            <div className="personal-message-empty">왼쪽 목록에서 메시지를 선택해 주세요.</div>
          ) : (
            <article className="personal-message-detail">
              <div className="personal-message-detail__head">
                <h4>{selectedMessage.title || '개인메시지'}</h4>
                <p>발송/수정 {formatDateTime(selectedMessage.updatedAt)}</p>
              </div>
              <section className="personal-message-detail__section">
                <h5>메시지 내용</h5>
                <div className="personal-message-detail__content">
                  {selectedMessage.content || '내용 없이 첨부파일만 보낸 메시지입니다.'}
                </div>
              </section>
              <section className="personal-message-detail__section">
                <h5>첨부파일</h5>
                {selectedMessage.attachments?.length ? (
                  <div className="personal-message-attachments">
                    {selectedMessage.attachments.map((file) => (
                      <a key={file.id} className="personal-message-attachments__item" href={file.url} target="_blank" rel="noreferrer">
                        <span>{file.fileName || '첨부파일'}</span>
                        <small>{file.kind === 'image' ? '이미지' : '파일'}</small>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="personal-message-empty personal-message-empty--compact">첨부파일이 없습니다.</div>
                )}
              </section>
              <section className="personal-message-detail__section personal-message-detail__section--comments">
                <h5>댓글/답글</h5>
                <div className="personal-message-empty personal-message-empty--compact">
                  댓글 API 연결 후 이 영역에 고객/담당자 댓글이 표시됩니다.
                </div>
              </section>
            </article>
          )}
        </div>
      </section>

      <aside className="personal-message-panel personal-message-panel--compose" aria-label="새 개인메시지 작성">
        <header className="personal-message-panel__header">
          <div className="personal-message-panel__title-group">
            <h3>새 개인메시지 작성</h3>
            <p>{targetCustomerName}에게만 발송됩니다.</p>
          </div>
        </header>
        <div className="personal-message-panel__body personal-message-panel__body--compose">
          <FormTextarea
            rows={9}
            value={form.bodyText}
            onChange={(e) => form.setBodyText(e.target.value)}
            placeholder="고객에게 보낼 개인메시지 내용을 입력해 주세요."
            disabled={busy}
          />
          <FileUploader
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.hwpx"
            validateFile={validateNewsletterFile}
            onFiles={form.addAttachments}
            onInvalidBatch={(failures) => setError(failures[0]?.message ?? '첨부할 수 없는 파일이 있습니다.')}
            multiple
            compact
            disabled={busy}
            statusText={uploadBusyText ?? undefined}
            primaryHint="파일 첨부"
            hintLines={['사진, PDF, 문서 파일을 첨부할 수 있습니다.']}
          />
          {form.attachments.length > 0 ? (
            <div className="personal-message-draft-files">
              {form.attachments.map((attachment) => (
                <div key={attachment.localId} className="personal-message-draft-files__item">
                  <span>{attachment.file.name}</span>
                  <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => form.removeAttachment(attachment.localId)} disabled={busy}>
                    삭제
                  </FormButton>
                </div>
              ))}
            </div>
          ) : null}
          <div className="personal-message-compose__footer">
            {notice ? <div className="personal-message-notice personal-message-notice--ok">{notice}</div> : null}
            {error ? <div className="personal-message-notice personal-message-notice--error">{error}</div> : null}
            <FormButton htmlType="button" variant="primary" onClick={() => void handleSend()} loading={busy} disabled={busy}>
              개인메시지 발송
            </FormButton>
          </div>
        </div>
      </aside>
    </section>
  )
}
