import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  confirmAiImportCommit,
  fetchLatestAiConversation,
  sendAiAssistantMessage,
  uploadAiImportFile,
  type AiAssistantMessage,
} from '../api/aiSecretaryApi'
import { FormButton } from '../../../components/form'
import './ai-secretary-page.css'

const SUGGESTIONS = ['고객 엑셀 가져오기', '고객 찾기', '오늘 할 일', '일정 확인']

export default function AiSecretaryPage() {
  const { token, user } = useAuth()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [importSessionId, setImportSessionId] = useState<string | undefined>()
  const [messages, setMessages] = useState<AiAssistantMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGaDesigner =
    user?.role === 'USER' || user?.role === 'GA_ADMIN' || user?.role === 'GA_STAFF'

  useEffect(() => {
    if (!token || !isGaDesigner) {
      return
    }
    void fetchLatestAiConversation(token)
      .then((res) => {
        const conv = res.conversation
        if (!conv) {
          return
        }
        setConversationId(conv.conversationId)
        if (conv.importSessionId) {
          setImportSessionId(conv.importSessionId)
        }
        if (Array.isArray(conv.messages) && conv.messages.length > 0) {
          setMessages(conv.messages)
        }
      })
      .catch(() => {
        /* 최근 대화 없음 — 무시 */
      })
  }, [token, isGaDesigner])

  async function handleSend(forcedText?: string) {
    if (!token || busy) {
      return
    }
    const payload = (forcedText ?? text).trim()
    if (!payload) {
      return
    }
    setBusy(true)
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', kind: 'text', text: payload }])
    setText('')
    try {
      const res = await sendAiAssistantMessage(token, {
        conversationId,
        text: payload,
        importSessionId,
      })
      setConversationId(res.conversationId)
      setMessages((prev) => [...prev, ...res.messages])
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(file: File | null) {
    if (!token || !file) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await uploadAiImportFile(token, file)
      setImportSessionId(res.importSessionId)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', kind: 'text', text: `파일을 첨부했습니다: ${file.name}` },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : '첨부 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(card: Extract<AiAssistantMessage, { kind: 'import_preview_card' }>) {
    if (!token || !importSessionId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await confirmAiImportCommit(token, card.preview.confirmationId, {
        importSessionId,
        previewVersionHash: card.preview.previewVersionHash,
      })
      const summary = (result as { summary?: { created?: number } }).summary
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          kind: 'text',
          text: `등록 완료: ${summary?.created ?? 0}건 (실제 Tool 결과 기준)`,
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패')
    } finally {
      setBusy(false)
    }
  }

  if (!isGaDesigner) {
    return (
      <div className="ai-secretary-page">
        <h1>ONE FC AI 비서</h1>
        <p>GA 설계사 계정에서 이용할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="ai-secretary-page">
      <header className="ai-secretary-page__header">
        <h1>ONE FC AI 비서</h1>
      </header>
      <div className="ai-secretary-page__messages" aria-live="polite">
        {messages.map((msg, index) => {
          if (msg.kind === 'import_preview_card') {
            return (
              <div key={index} className="ai-secretary-card">
                <strong>{msg.text}</strong>
                <p>파일: {msg.preview.fileName ?? '—'}</p>
                <p>등록 예정: {msg.preview.summary.plannedCreate ?? 0}</p>
                <p>중복(파일): {msg.preview.summary.duplicateInFile ?? 0}</p>
                <p>기존 CRM 중복: {msg.preview.summary.duplicateExisting ?? 0}</p>
                <FormButton
                  htmlType="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => handleConfirm(msg)}
                >
                  {msg.preview.summary.plannedCreate ?? 0}명 등록
                </FormButton>
              </div>
            )
          }
          return (
            <div
              key={index}
              className={`ai-secretary-bubble ai-secretary-bubble--${msg.role}`}
            >
              {msg.text}
            </div>
          )
        })}
        {busy ? <p className="ai-secretary-status">처리 중…</p> : null}
        {error ? <p className="ai-secretary-error">{error}</p> : null}
      </div>
      <div className="ai-secretary-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="ai-secretary-suggestion" onClick={() => handleSend(s)}>
            {s}
          </button>
        ))}
      </div>
      <footer className="ai-secretary-composer">
        <button
          type="button"
          className="ai-secretary-attach"
          aria-label="파일 첨부"
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <input
          className="ai-secretary-input"
          placeholder="무엇을 도와드릴까요?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => handleSend()}>
          ↑
        </FormButton>
      </footer>
    </div>
  )
}
