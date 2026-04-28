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

function parsePositiveInt(raw: string | null | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function attachmentLabel(item: AgentCustomerNewsItem): string {
  const count = item.attachments?.length ?? 0
  return count > 0 ? `첨부 ${count}개` : '첨부 없음'
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
        if (prev && rows.some((item) => item.id === prev)) {
          return prev
        }
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
        setError('일부 파일 업로드에 실패했습니다. 실패 항목을 삭제하고 다시 시도해 주세요.')
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
      const title = `${targetCustomerName} 고객님께`
      const created = await createCustomerNews(token, {
        title,
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
    <main className="page claim-requests-page claim-requests-page--pc page--with-back content-wrapper">
      <section className="claim-requests-page__personal-workspace" aria-label="개인메시지 작업공간">
        <div className="claim-requests-page__personal-column claim-requests-page__personal-column--list">
          <div className="claim-requests-page__section-header">
            <div>
              <h3>{targetCustomerName} 개인메시지</h3>
              <p>현재 고객에게 보낸 개인메시지만 표시합니다.</p>
            </div>
            <FormButton htmlType="button" variant="secondary" onClick={() => void loadMessages()} loading={loading}>
              새로고침
            </FormButton>
          </div>
          {loading ? <div className="claim-requests-page__detail-empty">불러오는 중…</div> : null}
          {!loading && messages.length === 0 ? (
            <div className="claim-requests-page__detail-empty">아직 보낸 개인메시지가 없습니다.</div>
          ) : null}
          <div className="claim-requests-page__list">
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                className={`claim-requests-page__list-row${selectedMessage?.id === message.id ? ' claim-requests-page__list-row--active' : ''}`}
                onClick={() => setSelectedMessageId(message.id)}
              >
                <strong>{message.title || '개인메시지'}</strong>
                <span>{message.content || '첨부파일 메시지'}</span>
                <small>{formatDateTime(message.updatedAt)} · {attachmentLabel(message)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="claim-requests-page__personal-column claim-requests-page__personal-column--preview">
          <div className="claim-requests-page__section-header">
            <div>
              <h3>고객앱 미리보기</h3>
              <p>고객에게 보이는 메시지 내용과 첨부파일을 확인합니다.</p>
            </div>
          </div>
          {!selectedMessage ? (
            <div className="claim-requests-page__detail-empty">왼쪽 목록에서 메시지를 선택해 주세요.</div>
          ) : (
            <article className="claim-requests-page__detail-section">
              <div className="claim-requests-page__detail-title">{selectedMessage.title || '개인메시지'}</div>
              <div className="claim-requests-page__detail-meta">발송/수정 {formatDateTime(selectedMessage.updatedAt)}</div>
              <div className="claim-requests-page__detail-text claim-requests-page__detail-text--memo">
                {selectedMessage.content || '내용 없이 첨부파일만 보낸 메시지입니다.'}
              </div>
              <div className="claim-requests-page__detail-subtitle">첨부파일</div>
              {selectedMessage.attachments?.length ? (
                <div className="claim-requests-page__file-list">
                  {selectedMessage.attachments.map((file) => (
                    <a
                      key={file.id}
                      className="claim-requests-page__file-row"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{file.fileName || '첨부파일'}</span>
                      <small>{file.kind === 'image' ? '이미지' : '파일'}</small>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="claim-requests-page__detail-empty">첨부파일이 없습니다.</div>
              )}
              <div className="claim-requests-page__detail-subtitle">댓글/답글</div>
              <div className="claim-requests-page__detail-empty">
                댓글 기능은 별도 댓글 API가 연결되면 이 영역에 표시됩니다.
              </div>
            </article>
          )}
        </div>

        <div className="claim-requests-page__personal-column claim-requests-page__personal-column--compose">
          <div className="claim-requests-page__section-header">
            <div>
              <h3>새 개인메시지 작성</h3>
              <p>{targetCustomerName}에게만 발송됩니다.</p>
            </div>
          </div>
          <FormTextarea
            rows={8}
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
            <div className="claim-requests-page__file-list">
              {form.attachments.map((attachment) => (
                <div key={attachment.localId} className="claim-requests-page__file-row">
                  <span>{attachment.file.name}</span>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => form.removeAttachment(attachment.localId)}
                    disabled={busy}
                  >
                    삭제
                  </FormButton>
                </div>
              ))}
            </div>
          ) : null}
          {notice ? <div className="claim-requests-page__notice claim-requests-page__notice--ok">{notice}</div> : null}
          {error ? <div className="claim-requests-page__notice claim-requests-page__notice--error">{error}</div> : null}
          <FormButton htmlType="button" onClick={() => void handleSend()} loading={busy} disabled={busy}>
            개인메시지 발송
          </FormButton>
        </div>
      </section>
    </main>
  )
}
