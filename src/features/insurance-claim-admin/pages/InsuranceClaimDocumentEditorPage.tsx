import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { PdfCoordinateEditor } from '../../pdf-engine/components/PdfCoordinateEditor'
import {
  fetchInsuranceClaimDocumentFile,
  getInsuranceClaimDocument,
  saveInsuranceClaimDocumentFields,
} from '../api/insuranceClaimAdminApi'
import { INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS } from '../insuranceClaimAdmin.config'
import { useAuth } from '../../auth/AuthProvider'
import type { PdfFieldSpec, PdfInputRole } from '../../pdf-engine/types'
import { normalizePdfFieldKeys } from '../../pdf-engine/pdfFieldKey'
import { dedupeRadioPlacementsInFields, validatePdfTemplateFieldsForSave } from '../../pdf-engine/validatePdfTemplateFieldsForSave'
import { pdfFieldSpecsForSavePayload, readPdfFieldDataMappingFromField } from '../../pdf-engine/lib/resolvePdfFieldValue'
import { persistFieldsSavedToast, persistFieldsSkippedToast } from '../../pdf-engine/lib/pdfTemplateEditorPersistPolicy'
import '../../pdf-engine/pdf-engine.css'
import '../insurance-claim-admin.css'

function coerceFieldForEditor(f: PdfFieldSpec): PdfFieldSpec {
  const inputRole: PdfInputRole =
    f.fieldType === 'signature'
      ? 'customer'
      : f.inputRole === 'sender' || f.inputRole === 'disabled' || f.inputRole === 'customer'
        ? f.inputRole
        : 'customer'
  return {
    ...f,
    inputRole,
    dataMapping: readPdfFieldDataMappingFromField(f),
  }
}

export default function InsuranceClaimDocumentEditorPage() {
  const { id: companyIdParam, documentId: documentIdParam } = useParams<{
    id: string
    documentId: string
  }>()
  const companyId = Number(companyIdParam)
  const documentId = Number(documentIdParam)
  const { token } = useAuth()

  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null)
  const [fields, setFields] = useState<PdfFieldSpec[]>([])
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingFields, setSavingFields] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim() || !Number.isInteger(documentId) || documentId < 1) return
    setLoading(true)
    setError('')
    try {
      const detail = await getInsuranceClaimDocument(token, documentId)
      const buffer = await fetchInsuranceClaimDocumentFile(token, documentId)
      const coerced = detail.fields.map(coerceFieldForEditor)
      const { fields: normalizedFields, keysChanged } = normalizePdfFieldKeys(coerced)
      setTitle(detail.document.title)
      setDocumentType(detail.document.documentType)
      setPageCount(detail.document.pageCount)
      setPdfBuffer(buffer)
      setFields(normalizedFields)
      setFieldsDirty(keysChanged)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '문서를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [documentId, token])

  useEffect(() => {
    void load()
  }, [load])

  const onSaveFields = async () => {
    if (!token?.trim()) return
    if (!fieldsDirty) {
      setToast(persistFieldsSkippedToast())
      return
    }
    setSavingFields(true)
    setToast(null)
    try {
      const { fields: fieldsToSave, keysChanged } = normalizePdfFieldKeys(fields)
      const dedupedFields = dedupeRadioPlacementsInFields(fieldsToSave)
      const validationError = validatePdfTemplateFieldsForSave(dedupedFields)
      if (validationError) {
        setToast(validationError)
        return
      }
      const payloadFields = pdfFieldSpecsForSavePayload(dedupedFields)
      const saved = await saveInsuranceClaimDocumentFields(token, documentId, payloadFields)
      setFields(saved.fields.map(coerceFieldForEditor))
      setFieldsDirty(false)
      setToast(persistFieldsSavedToast(keysChanged))
    } catch (e) {
      setToast(e instanceof ApiError ? `좌표 저장 실패: ${e.message}` : '좌표 저장 실패')
    } finally {
      setSavingFields(false)
    }
  }

  const docLabel =
    documentType in INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS
      ? INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS[documentType as keyof typeof INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS]
      : '청구 문서'

  return (
    <main className="user-page pdf-engine-page pdf-engine-page--editor insurance-claim-admin-page insurance-claim-admin-page--document-editor">
      <div className="insurance-claim-admin-page__toolbar">
        <Link to={`/admin/claim/insurance-companies/${companyId}`} className="insurance-claim-admin-link">
          ← 보험회사 상세
        </Link>
      </div>
      <h1 className="pdf-engine-page__title">
        {title || docLabel} — 좌표 설정
      </h1>
      <p className="insurance-claim-admin-page__hint">
        보험청구 전용 PDF 좌표입니다. 일반 PDF 문서 템플릿과 저장 위치가 분리되어 있습니다.
      </p>
      {error ? (
        <p className="insurance-claim-admin-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="insurance-claim-admin-page__info" role="status">
          {toast}
        </p>
      ) : null}
      {loading ? <p className="insurance-claim-admin-page__hint">불러오는 중…</p> : null}
      {!loading && pdfBuffer ? (
        <PdfCoordinateEditor
          layout="sidebar-preview"
          pdfBuffer={pdfBuffer}
          pageCount={pageCount}
          fields={fields}
          onChange={(next) => {
            setFields(next)
            setFieldsDirty(true)
          }}
          onSaveFields={() => void onSaveFields()}
          savingFields={savingFields}
          fieldsDirty={fieldsDirty}
          templateId={documentId}
        />
      ) : null}
    </main>
  )
}
