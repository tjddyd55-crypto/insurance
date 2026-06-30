/**
 * 관리자 PDF 템플릿 에디터 페이지.
 *
 * 하나의 페이지가 두 가지 모드를 담당한다:
 *   - 신규(`/admin/pdf-templates/new`): GA·code·title 입력 + PDF 업로드 → 생성 성공 시 edit 경로로 이동
 *   - 편집(`/admin/pdf-templates/:id`): 서버에서 불러와 메타·필드·좌표를 저장
 *
 * 관심사 분리:
 *   - `PdfCoordinateEditor` 는 필드·좌표 편집 UI 만 담당(I/O 없음).
 *   - 이 페이지는 API 호출과 상태 오케스트레이션만 담당.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listGaCompanies, type GaCompanyRow } from '../../auth/authApi'
import {
  createAdminPdfTemplate,
  fetchAdminPdfTemplateFile,
  getAdminPdfTemplate,
  patchAdminPdfTemplate,
  saveAdminPdfTemplateFields,
  uploadAdminPdfTemplateFile,
} from '../api/pdfTemplateApi'
import { PdfCoordinateEditor } from '../components/PdfCoordinateEditor'
import { validatePdfTemplateFieldsForSave, dedupeRadioPlacementsInFields } from '../validatePdfTemplateFieldsForSave'
import { normalizePdfFieldKeys } from '../pdfFieldKey'
import {
  pdfFieldSpecsForSavePayload,
  readPdfFieldDataMappingFromField,
} from '../lib/resolvePdfFieldValue'
import {
  handleSaveCompleteToast,
  persistFieldsSavedToast,
  persistFieldsSkippedToast,
  type PersistFieldsResult,
} from '../lib/pdfTemplateEditorPersistPolicy'
import type { PdfFieldSpec, PdfInputRole, PdfTemplateSummary } from '../types'
import '../pdf-engine.css'

function radioPlacementsChangedByDedupe(before: PdfFieldSpec[], after: PdfFieldSpec[]): boolean {
  const map = new Map(before.map((f) => [f.fieldKey, f]))
  for (const nf of after) {
    if (nf.fieldType !== 'radio') continue
    const pf = map.get(nf.fieldKey)
    if (!pf || pf.fieldType !== 'radio') continue
    if (JSON.stringify(pf.placements) !== JSON.stringify(nf.placements)) return true
  }
  return false
}

export default function PdfTemplateEditorPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const isNew = !idParam || idParam === 'new'
  const numericId = isNew ? null : Number(idParam)
  const navigate = useNavigate()
  const { token } = useAuth()

  return isNew ? (
    <CreateTemplateFlow token={token ?? ''} onCreated={(id) => navigate(`/admin/pdf-templates/${id}`)} />
  ) : (
    <EditTemplateFlow token={token ?? ''} templateId={Number(numericId)} />
  )
}

// ────────────────────────────────────────────────────────────────────────
// 생성 플로우: 메타 입력 → PDF 업로드 → 서버 저장 → 편집 화면으로 이동
// ────────────────────────────────────────────────────────────────────────

function CreateTemplateFlow({
  token,
  onCreated,
}: {
  token: string
  onCreated: (id: number) => void
}) {
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaId, setGaId] = useState<'' | number>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      setFiles([])
      return
    }
    const selected = Array.from(fileList)
    const invalid = selected.find(
      (f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'),
    )
    if (invalid) {
      setError('PDF 파일만 업로드할 수 있습니다.')
      setFiles([])
      return
    }
    setError(null)
    setFiles(selected)
  }

  useEffect(() => {
    if (!token) return
    listGaCompanies(token)
      .then(setGaList)
      .catch(() => {
        /* GA 목록 실패는 치명적이지 않음 — 공용(null)으로 생성 가능. */
      })
  }, [token])

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!token) return
    if (!title.trim()) {
      setError('문서 제목을 입력하세요.')
      return
    }
    if (files.length === 0) {
      setError('PDF 파일을 선택하세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const gaIdValue = gaId === '' ? null : Number(gaId)
      const uploaded = await uploadAdminPdfTemplateFile(token, {
        gaId: gaIdValue,
        files,
      })
      const created = await createAdminPdfTemplate(token, {
        gaId: gaIdValue,
        title: title.trim(),
        description: description.trim(),
        storageKey: uploaded.storageKey,
        pageCount: uploaded.pageCount,
        sourcePdfMetadata: uploaded.sourcePdfMetadata,
      })
      onCreated(created.template.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '템플릿 생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="user-page pdf-engine-page pdf-engine-page--editor">
      <h1 className="pdf-engine-page__title">새 PDF 템플릿</h1>
      <div className="pdf-engine-page__toolbar">
        <Link to="/admin/pdf-templates" className="pdf-engine-editor__btn">
          ← 목록
        </Link>
      </div>
      {error ? <div className="pdf-engine-page__error">{error}</div> : null}
      <form className="pdf-engine-form" onSubmit={handleSubmit}>
        <label className="pdf-engine-editor__label">
          소속 GA (미지정이면 전 GA 공용)
          <FormSelect
            value={gaId === '' ? '' : String(gaId)}
            options={[
              { value: '', label: '(공용)' },
              ...gaList.map((g) => ({ value: String(g.id), label: `${g.name} (${g.code})` })),
            ]}
            onChange={(e) => setGaId(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="pdf-engine-editor__label">
          문서 제목
          <FormInput
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 자동차보험 개인정보 동의서"
          />
        </label>
        <label className="pdf-engine-editor__label">
          설명 (선택)
          <FormTextarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="사용자에게 보일 간단한 설명"
          />
        </label>
        <label className="pdf-engine-editor__label">
          PDF 파일
          <span className="pdf-engine-editor__label-hint">
            여러 PDF 파일 선택 가능 · 선택된 순서대로 병합됩니다.
          </span>
          <FormInput
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </label>
        {files.length > 0 ? (
          <ol className="pdf-engine-upload-file-list" aria-label="선택된 PDF 파일">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`}>
                {i + 1}. {f.name}
              </li>
            ))}
          </ol>
        ) : null}
        <FormButton
          htmlType="submit"
          variant="primary"
          className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
          disabled={submitting}
        >
          {submitting ? '등록 중…' : '등록하고 좌표 편집으로'}
        </FormButton>
      </form>
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 편집 플로우: 서버에서 템플릿·필드·원본 PDF 로드 → 좌표 에디터 → 저장
// ────────────────────────────────────────────────────────────────────────

function coercePdfFieldSpecForEditor(f: PdfFieldSpec & { id?: number; customerMapping?: unknown }): PdfFieldSpec {
  const rest = { ...f } as PdfFieldSpec & { id?: number; customerMapping?: unknown }
  delete rest.id
  const inputRole: PdfInputRole =
    rest.fieldType === 'signature'
      ? 'customer'
      : rest.inputRole === 'sender' || rest.inputRole === 'disabled' || rest.inputRole === 'customer'
        ? rest.inputRole
        : 'customer'
  return {
    ...rest,
    inputRole,
    dataMapping: readPdfFieldDataMappingFromField(rest),
  }
}

function logPdfTemplateFieldMappingDebug(payload: {
  fieldKey: string
  beforeMapping: PdfFieldSpec['dataMapping']
  savePayloadMapping: PdfFieldSpec['dataMapping']
  responseMapping?: PdfFieldSpec['dataMapping']
}): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug('pdf template field mapping debug', payload)
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; template: PdfTemplateSummary; fields: PdfFieldSpec[]; pdfBuffer: ArrayBuffer }

function EditTemplateFlow({ token, templateId }: { token: string; templateId: number }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaId, setGaId] = useState<'' | number>('')
  const [fields, setFields] = useState<PdfFieldSpec[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingFields, setSavingFields] = useState(false)
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listGaCompanies(token)
      .then(setGaList)
      .catch(() => {
        /* GA 목록 실패 시에도 기존 템플릿 편집은 가능해야 한다. */
      })
  }, [token])

  const load = useCallback(async () => {
    if (!token) return
    setState({ status: 'loading' })
    try {
      const detail = await getAdminPdfTemplate(token, templateId)
      const pdfBuffer = await fetchAdminPdfTemplateFile(token, templateId)
      const coerced = detail.fields.map(coercePdfFieldSpecForEditor)
      const { fields: normalizedFields, keysChanged } = normalizePdfFieldKeys(coerced)
      setFields(normalizedFields)
      setFieldsDirty(keysChanged)
      setGaId(detail.template.gaId ?? '')
      setTitle(detail.template.title)
      setDescription(detail.template.description ?? '')
      setIsActive(detail.template.isActive)
      setState({
        status: 'ready',
        template: detail.template,
        fields: normalizedFields,
        pdfBuffer,
      })
      if (keysChanged) {
        setToast(
          '일부 필드 식별자(key)가 유효한 형식으로 자동 보정되었습니다. 저장하면 서버에 반영됩니다.',
        )
      }
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof ApiError ? e.message : '템플릿을 불러오지 못했습니다.',
      })
    }
  }, [token, templateId])

  useEffect(() => {
    void load()
  }, [load])

  const persistFields = useCallback(
    async (options?: { silent?: boolean }): Promise<PersistFieldsResult> => {
      if (!token || state.status !== 'ready') return 'failed'
      if (!fieldsDirty) {
        if (!options?.silent) {
          setToast(persistFieldsSkippedToast())
        }
        return 'skipped'
      }
      setSavingFields(true)
      if (!options?.silent) {
        setToast(null)
      }
      try {
        const { fields: fieldsToSave, keysChanged: keysNormalized } = normalizePdfFieldKeys(fields)
        const dedupedFields = dedupeRadioPlacementsInFields(fieldsToSave)
        const radioDeduped = radioPlacementsChangedByDedupe(fieldsToSave, dedupedFields)
        if (keysNormalized || radioDeduped) {
          setFields(dedupedFields)
          if (radioDeduped && !keysNormalized) {
            setFieldsDirty(true)
          }
        }
        const validationError = validatePdfTemplateFieldsForSave(dedupedFields)
        if (validationError) {
          setToast(validationError)
          return 'failed'
        }
        const payloadFields = pdfFieldSpecsForSavePayload(dedupedFields)
        if (import.meta.env.DEV && payloadFields[0]) {
          const before = dedupedFields.find((f) => f.fieldKey === payloadFields[0].fieldKey)
          logPdfTemplateFieldMappingDebug({
            fieldKey: payloadFields[0].fieldKey,
            beforeMapping: before?.dataMapping ?? payloadFields[0].dataMapping,
            savePayloadMapping: payloadFields[0].dataMapping,
          })
        }
        const saved = await saveAdminPdfTemplateFields(token, templateId, payloadFields)
        const coerced = saved.fields.map(coercePdfFieldSpecForEditor)
        if (import.meta.env.DEV && coerced[0]) {
          logPdfTemplateFieldMappingDebug({
            fieldKey: coerced[0].fieldKey,
            beforeMapping: payloadFields.find((f) => f.fieldKey === coerced[0].fieldKey)?.dataMapping ?? coerced[0].dataMapping,
            savePayloadMapping:
              payloadFields.find((f) => f.fieldKey === coerced[0].fieldKey)?.dataMapping ?? coerced[0].dataMapping,
            responseMapping: coerced[0].dataMapping,
          })
        }
        setFields(coerced)
        setFieldsDirty(false)
        if (!options?.silent) {
          setToast(persistFieldsSavedToast(keysNormalized))
        }
        return 'saved'
      } catch (e) {
        setToast(e instanceof ApiError ? `좌표 저장 실패: ${e.message}` : '좌표 저장 실패')
        return 'failed'
      } finally {
        setSavingFields(false)
      }
    },
    [fields, fieldsDirty, state.status, templateId, token],
  )

  const handleSave = async () => {
    if (!token || state.status !== 'ready') return
    setSaving(true)
    setToast(null)
    try {
      /* 메타(title/description/isActive) → 필드 순서로 저장.
         필드 저장이 실패해도 메타는 반영되도록 분리. */
      const metaResult = await patchAdminPdfTemplate(token, templateId, {
        gaId: gaId === '' ? null : Number(gaId),
        title: title.trim(),
        description: description.trim(),
        isActive,
      })
      if (metaResult.template) {
        setGaId(metaResult.template.gaId ?? '')
        setState((prev) =>
          prev.status === 'ready'
            ? {
                ...prev,
                template: metaResult.template as PdfTemplateSummary,
              }
            : prev,
        )
      }
      const fieldsResult = await persistFields({ silent: true })
      const completeToast = handleSaveCompleteToast(fieldsResult)
      if (completeToast) {
        setToast(completeToast)
      }
    } catch (e) {
      setToast(e instanceof ApiError ? `저장 실패: ${e.message}` : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const headerMeta = useMemo(() => {
    if (state.status !== 'ready') return null
    const t = state.template
    /* 내부 식별자(code) 는 의도적으로 숨긴다 — 관리자가 다뤄야 할 값이 아니다.
       #id 는 운영 상황에서 서버 로그와 교차 확인할 때 유일하게 필요한 흔적. */
    return (
      <span className="pdf-engine-editor__field-meta">
        #{t.id} · {t.gaId == null ? '공용' : `${t.gaName ?? `GA#${t.gaId}`}`} · {t.pageCount} 페이지
      </span>
    )
  }, [state])

  if (state.status === 'loading') {
    return (
      <main className="user-page pdf-engine-page">
        <p className="pdf-engine-page__hint">템플릿을 불러오는 중…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="user-page pdf-engine-page">
        <div className="pdf-engine-page__error">{state.message}</div>
        <div className="pdf-engine-page__toolbar">
          <Link to="/admin/pdf-templates" className="pdf-engine-editor__btn">
            ← 목록으로
          </Link>
          <FormButton htmlType="button" className="pdf-engine-editor__btn" onClick={() => void load()}>
            다시 시도
          </FormButton>
        </div>
      </main>
    )
  }

  return (
    <main className="user-page pdf-engine-page pdf-engine-page--editor pdf-engine-page--template-editor">
      <div className="pdf-engine-page__toolbar">
        <Link to="/admin/pdf-templates" className="pdf-engine-editor__btn">
          ← 목록
        </Link>
        <FormButton
          htmlType="button"
          className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? '저장 중…' : '저장'}
        </FormButton>
        {toast ? <span className="pdf-engine-page__hint pdf-engine-page__hint--inline">{toast}</span> : null}
      </div>

      <div className="pdf-engine-page__header">
        <h1 className="pdf-engine-page__title">PDF 템플릿 편집</h1>
        {headerMeta}
      </div>

      <section className="pdf-engine-form pdf-engine-form--inline pdf-engine-form--meta-compact">
        <label className="pdf-engine-editor__label">
          소속 GA
          <FormSelect
            value={gaId === '' ? '' : String(gaId)}
            options={[
              { value: '', label: '(공용)' },
              ...gaList.map((g) => ({ value: String(g.id), label: `${g.name} (${g.code})` })),
            ]}
            onChange={(e) => setGaId(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="pdf-engine-editor__label">
          문서 제목
          <FormInput type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="pdf-engine-editor__label">
          설명
          <FormInput type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="pdf-engine-editor__label pdf-engine-editor__label--checkbox">
          <FormInput
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />{' '}
          활성
        </label>
      </section>

      <PdfCoordinateEditor
        editorVariant="compact"
        templateId={templateId}
        pdfBuffer={state.pdfBuffer}
        pageCount={state.template.pageCount}
        fields={fields}
        onChange={(next) => {
          setFields(next)
          setFieldsDirty(true)
        }}
        onSaveFields={() => void persistFields()}
        savingFields={savingFields}
        fieldsDirty={fieldsDirty}
      />
    </main>
  )
}
