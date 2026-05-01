/**
 * 사용자용 문서 상세 — 폼 입력 → PDF 발급.
 *
 * 책임:
 *   - 서버에서 단건 템플릿(필드 포함) 로드
 *   - `PdfTemplateForm` 에 위임해 입력 받고, submit 시 render API 호출
 *   - Blob → 브라우저 다운로드 트리거(메모리 정리까지)
 *
 * 폼 UI 의 세부는 `PdfTemplateForm` 에 있으므로, 이 페이지는 얇게 유지한다.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getPdfTemplate, renderPdfTemplate } from '../api/pdfTemplateApi'
import { PdfTemplateForm } from '../components/PdfTemplateForm'
import type { PdfFieldSpec, PdfInputRole, PdfTemplateSummary } from '../types'
import '../pdf-engine.css'

function coercePdfFieldSpecForForm(f: PdfFieldSpec & { id?: number }): PdfFieldSpec {
  const rest = { ...f } as PdfFieldSpec & { id?: number }
  delete rest.id
  const inputRole: PdfInputRole =
    rest.fieldType === 'signature'
      ? 'customer'
      : rest.inputRole === 'sender' || rest.inputRole === 'disabled' || rest.inputRole === 'customer'
        ? rest.inputRole
        : 'customer'
  return { ...rest, inputRole }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; template: PdfTemplateSummary; fields: PdfFieldSpec[] }

/** Blob → 브라우저 다운로드. URL 누수 방지를 위해 즉시 revoke 한다. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export default function PdfDocumentDetailPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const templateId = Number(idParam)
  const { token } = useAuth()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [submitting, setSubmitting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewValues, setPreviewValues] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewValues(null)
    setPreviewError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  useEffect(() => {
    if (!token?.trim()) return
    if (!Number.isInteger(templateId) || templateId < 1) {
      setState({ status: 'error', message: '잘못된 문서 주소입니다.' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    getPdfTemplate(token, templateId)
      .then((res) => {
        if (cancelled) return
        setState({ status: 'ready', template: res.template, fields: res.fields.map(coercePdfFieldSpecForForm) })
      })
      .catch((e) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: e instanceof ApiError ? e.message : '문서를 불러오지 못했습니다.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token, templateId])

  const handleSubmit = async (values: Record<string, string>) => {
    if (!token || state.status !== 'ready') return
    setSubmitting(true)
    try {
      const blob = await renderPdfTemplate(token, templateId, values, { preview: true })
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      const nextUrl = URL.createObjectURL(blob)
      setPreviewUrl(nextUrl)
      setPreviewValues(values)
      setPreviewError(null)
      setPreviewOpen(true)
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'PDF 생성에 실패했습니다.'
      throw new Error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveFromPreview = async () => {
    if (!token || state.status !== 'ready' || !previewValues) return
    setSaving(true)
    setPreviewError(null)
    try {
      const blob = await renderPdfTemplate(token, templateId, previewValues)
      triggerDownload(blob, `${state.template.code}.pdf`)
      closePreview()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'PDF 저장에 실패했습니다.'
      setPreviewError(message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (state.status === 'loading') {
    return (
      <main className="insurance-dark-forms pdf-engine-page">
        <p className="pdf-engine-page__hint">문서를 불러오는 중…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="insurance-dark-forms pdf-engine-page">
        <div className="pdf-engine-page__error">{state.message}</div>
        <div className="pdf-engine-page__toolbar">
          <Link to="/application/documents" className="pdf-engine-editor__btn">
            ← 문서 목록
          </Link>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="pdf-engine-editor__btn"
            onClick={() => navigate(0)}
          >
            다시 시도
          </FormButton>
        </div>
      </main>
    )
  }

  return (
    <main className="insurance-dark-forms pdf-engine-page">
      <div className="pdf-engine-page__toolbar">
        <Link to="/application/documents" className="pdf-engine-editor__btn">
          ← 문서 목록
        </Link>
      </div>
      <PdfTemplateForm
        title={state.template.title}
        description={state.template.description}
        fields={state.fields}
        submitting={submitting}
        onSubmit={handleSubmit}
        submitLabel="결과보기"
      />
      <Modal
        open={previewOpen}
        onClose={() => {
          if (saving) return
          closePreview()
        }}
        ariaLabel="PDF 결과 미리보기"
        panelClassName="pdf-engine-preview-modal"
      >
        <div className="pdf-engine-preview">
          <header className="pdf-engine-preview__header">
            <h3>결과 미리보기</h3>
            <p>내용을 확인한 뒤 저장하거나, 수정으로 돌아갈 수 있습니다.</p>
          </header>
          {previewError ? <div className="pdf-engine-page__error">{previewError}</div> : null}
          <div className="pdf-engine-preview__frame-wrap">
            {previewUrl ? (
              <iframe title="PDF 미리보기" src={previewUrl} className="pdf-engine-preview__frame" />
            ) : (
              <p className="pdf-engine-page__hint">미리보기 파일을 준비하지 못했습니다.</p>
            )}
          </div>
          <div className="pdf-engine-preview__actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pdf-engine-editor__btn"
              onClick={closePreview}
              disabled={saving}
            >
              수정하기
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
              onClick={handleSaveFromPreview}
              disabled={saving || !previewValues}
            >
              {saving ? '저장 중…' : '저장하기'}
            </FormButton>
          </div>
        </div>
      </Modal>
    </main>
  )
}
