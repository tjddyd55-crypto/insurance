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
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getPdfTemplate, renderPdfTemplate } from '../api/pdfTemplateApi'
import { PdfTemplateForm } from '../components/PdfTemplateForm'
import type { PdfFieldSpec, PdfTemplateSummary } from '../types'
import '../pdf-engine.css'

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
        setState({ status: 'ready', template: res.template, fields: res.fields })
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
      const blob = await renderPdfTemplate(token, templateId, values)
      triggerDownload(blob, `${state.template.code}.pdf`)
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'PDF 생성에 실패했습니다.'
      throw new Error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="pdf-engine-page">
        <p className="pdf-engine-page__hint">문서를 불러오는 중…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="pdf-engine-page">
        <div className="pdf-engine-page__error">{state.message}</div>
        <div className="pdf-engine-page__toolbar">
          <Link to="/application/documents" className="pdf-engine-editor__btn">
            ← 문서 목록
          </Link>
          <button
            type="button"
            className="pdf-engine-editor__btn"
            onClick={() => navigate(0)}
          >
            다시 시도
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="pdf-engine-page">
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
      />
    </main>
  )
}
