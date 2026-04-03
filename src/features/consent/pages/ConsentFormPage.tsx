import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useAuth } from '../../auth/AuthProvider'
import { generateConsentPdf } from '../api/consentApi'
import { ConsentForm } from '../components/ConsentForm'
import { SignatureModal } from '../components/SignatureModal'
import type { ConsentCompanySelection, ConsentFormData } from '../domain/types'
import '../consent.css'

function resolvePdfOpenUrl(pdfUrl: string): string {
  if (/^https?:\/\//i.test(pdfUrl)) {
    return pdfUrl
  }
  if (typeof window !== 'undefined') {
    return new URL(pdfUrl, window.location.origin).href
  }
  return pdfUrl
}

function isConsentSelection(state: unknown): state is ConsentCompanySelection {
  if (!state || typeof state !== 'object') {
    return false
  }
  const s = state as Record<string, unknown>
  return (
    typeof s.gaId === 'number' &&
    Number.isFinite(s.gaId) &&
    typeof s.insuranceCompanyId === 'string' &&
    typeof s.insuranceCompanyName === 'string' &&
    typeof s.consentTemplateId === 'string'
  )
}

const EMPTY_FORM: ConsentFormData = {
  name: '',
  ssn: '',
  phone: '',
}

export function ConsentFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = useAuth()
  const selection = location.state

  const [formData, setFormData] = useState<ConsentFormData>(EMPTY_FORM)
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [sendNotice, setSendNotice] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!isConsentSelection(selection)) {
      navigate('/internal/consent', { replace: true })
    }
  }, [selection, navigate])

  if (!isConsentSelection(selection)) {
    return null
  }

  const { gaId, insuranceCompanyId, insuranceCompanyName, consentTemplateId } = selection

  const handleFormChange = (field: keyof ConsentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveSignature = (dataUrl: string) => {
    setSignatureImage(dataUrl)
  }

  const handleSend = async () => {
    setSendError(null)
    setSendNotice(null)
    if (!token?.trim()) {
      setSendError('로그인이 필요합니다.')
      return
    }
    if (!formData.name.trim()) {
      setSendError('이름을 입력하세요.')
      return
    }
    setIsSending(true)
    try {
      const res = await generateConsentPdf(token, {
        consent_template_id: consentTemplateId,
        formData: {
          name: formData.name.trim(),
          ssn: formData.ssn.trim(),
          phone: formData.phone.trim(),
        },
        signature: signatureImage,
      })
      const openUrl = resolvePdfOpenUrl(res.pdfUrl)
      setLastPdfUrl(openUrl)
      setSendNotice('동의서 PDF가 생성되었습니다. 새 탭에서 열 수 있습니다.')
      window.open(openUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'PDF 생성에 실패했습니다.'
      setSendError(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="consent-flow">
      <PageBackButton />
      <div className="consent-flow__inner">
        <nav style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="consent-btn consent-btn--secondary"
            onClick={() => navigate('/internal/consent')}
          >
            보험사 다시 선택
          </button>
        </nav>

        <ConsentForm
          gaId={gaId}
          insuranceCompanyId={insuranceCompanyId}
          insuranceCompanyName={insuranceCompanyName}
          consentTemplateId={consentTemplateId}
          formData={formData}
          onFormChange={handleFormChange}
          signatureImage={signatureImage}
          onOpenSignature={() => setSignatureOpen(true)}
          onSend={() => void handleSend()}
          isSending={isSending}
        />

        {sendNotice ? <p className="consent-mock-toast">{sendNotice}</p> : null}
        {sendError ? (
          <p className="consent-mock-toast" style={{ borderColor: 'var(--consent-border)', color: '#fca5a5' }}>
            {sendError}
          </p>
        ) : null}
        {lastPdfUrl ? (
          <p className="consent-mock-toast">
            <a href={lastPdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd' }}>
              PDF 다시 열기
            </a>
          </p>
        ) : null}
      </div>

      <SignatureModal open={signatureOpen} onClose={() => setSignatureOpen(false)} onSave={handleSaveSignature} />
    </main>
  )
}
