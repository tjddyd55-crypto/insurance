import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SignatureModal } from '../../consent/components/SignatureModal'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import '../../consent/consent.css'
import './contract-public-sign.css'
import {
  ApiError,
  fetchContractPublicDocumentDetail,
  formatContractPublicActionError,
  formatContractPublicCompleteError,
  postContractPublicDocumentComplete,
  postContractPublicDocumentSign,
  postContractPublicDocumentValues,
  resolveContractPdfPreviewAbsUrl,
  resolveContractRenderedPdfAbsUrl,
  type ContractDocumentDetailPayload,
  type ContractPublicValueInput,
} from './contractPublicClient'
import { PublicPdfPreviewModal } from './components/PublicPdfPreviewModal'
import { resolveApiUrl } from '../../../lib/apiClient'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(blob)
  })
}

function buildDraftsFromDetail(d: ContractDocumentDetailPayload): Record<string, string | boolean> {
  const next: Record<string, string | boolean> = {}
  for (const f of d.fields) {
    if (f.fieldType === 'signature') {
      continue
    }
    if (f.fieldType === 'checkbox') {
      next[f.id] = f.publicValue?.kind === 'checkbox' ? f.publicValue.checked : false
      continue
    }
    if (f.fieldType === 'radio') {
      const v = f.publicValue?.kind === 'radio' ? f.publicValue.value : ''
      next[f.id] = v || (typeof f.suggestedDefault === 'string' ? f.suggestedDefault : '')
      continue
    }
    const pv = f.publicValue?.kind === 'text' ? f.publicValue.value : ''
    const fallback = typeof f.suggestedDefault === 'string' ? f.suggestedDefault : ''
    next[f.id] = pv || fallback
  }
  return next
}

/** 서버 재조회 후에도 사용자가 이미 편집한 텍스트·선택·체크 값은 유지한다. */
function mergeDraftsFromDetail(
  prev: Record<string, string | boolean>,
  detail: ContractDocumentDetailPayload,
): Record<string, string | boolean> {
  const fromServer = buildDraftsFromDetail(detail)
  const next: Record<string, string | boolean> = { ...fromServer }
  for (const f of detail.fields) {
    if (f.fieldType === 'signature') {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(prev, f.id)) {
      next[f.id] = prev[f.id]
    }
  }
  return next
}

function sortFields(d: ContractDocumentDetailPayload) {
  return d.fields.slice().sort((a, b) => a.orderIndex - b.orderIndex)
}

function isRequiredSatisfied(
  f: ContractDocumentDetailPayload['fields'][number],
  drafts: Record<string, string | boolean>,
): boolean {
  if (!f.required) {
    return true
  }
  if (f.fieldType === 'signature') {
    return f.publicValue?.kind === 'signature' ? f.publicValue.signed : false
  }
  if (f.fieldType === 'checkbox') {
    return Boolean(drafts[f.id])
  }
  if (f.fieldType === 'radio') {
    return String(drafts[f.id] ?? '').trim().length > 0
  }
  return String(drafts[f.id] ?? '').trim().length > 0
}

function allRequiredFilled(detail: ContractDocumentDetailPayload, drafts: Record<string, string | boolean>) {
  return detail.fields.every((f) => isRequiredSatisfied(f, drafts))
}

async function downloadPdfWithCredentials(pathFromApi: string) {
  const url = resolveApiUrl(pathFromApi.startsWith('/api/') ? pathFromApi : `/api${pathFromApi}`)
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = 'signed-contract.pdf'
  a.click()
  URL.revokeObjectURL(u)
}

export default function ContractSignDocumentPage() {
  const { linkCode: linkCodeParam, documentInstanceId: docIdParam } = useParams<{
    linkCode: string
    documentInstanceId: string
  }>()
  const linkCode = String(linkCodeParam ?? '').trim()
  const documentInstanceId = String(docIdParam ?? '').trim()
  const paramsInvalid = !linkCode || !documentInstanceId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ContractDocumentDetailPayload | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string | boolean>>({})
  /** 필드별 마지막 적용 dataUrl — refetch 후에도 클라이언트에서 서명 초안 연속성 표시에 사용 */
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [signAck, setSignAck] = useState(false)
  const [sigModalField, setSigModalField] = useState<{ id: string; label: string } | null>(null)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfFetchNonce, setPdfFetchNonce] = useState(0)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [finalReviewOpen, setFinalReviewOpen] = useState(false)
  const [finalReviewLoadNonce, setFinalReviewLoadNonce] = useState(0)
  const [finalPreviewConfirmed, setFinalPreviewConfirmed] = useState(false)
  const [finalSubmitAck, setFinalSubmitAck] = useState(false)
  const [pdfLoadState, setPdfLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [successOpen, setSuccessOpen] = useState(false)
  const [completeResult, setCompleteResult] = useState<{
    evidenceSummary: ContractDocumentDetailPayload['evidenceSummary']
    signedPdfDownloadPath?: string
    signedPdfDownloadAvailable?: boolean
    completedAt?: string
  } | null>(null)

  const reloadDetail = useCallback(
    async (isCancelled?: () => boolean) => {
      const d = await fetchContractPublicDocumentDetail(linkCode, documentInstanceId)
      if (isCancelled?.()) {
        return
      }
      setDetail(d)
      await Promise.resolve()
      if (isCancelled?.()) {
        return
      }
      setDrafts((prev) => mergeDraftsFromDetail(prev, d))
    },
    [linkCode, documentInstanceId],
  )

  useEffect(() => {
    setSignatureDrafts({})
    setFinalPreviewConfirmed(false)
    setFinalSubmitAck(false)
  }, [linkCode, documentInstanceId])

  useEffect(() => {
    if (paramsInvalid || !detail) {
      return
    }
    const url = resolveContractPdfPreviewAbsUrl(linkCode, documentInstanceId)
    let cancelled = false

    setPdfLoadState('loading')
    setPdfBytes(null)

    void (async () => {
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/pdf')) {
          throw new Error(`unexpected content-type: ${ct}`)
        }
        const buf = await res.arrayBuffer()
        if (cancelled) {
          return
        }
        setPdfBytes(buf)
        setPdfLoadState('ready')
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[contract pdf preview]', e)
        }
        if (!cancelled) {
          setPdfLoadState('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detail, linkCode, documentInstanceId, paramsInvalid, pdfFetchNonce])

  useEffect(() => {
    if (paramsInvalid) {
      return
    }
    let cancelled = false
    const isCancelled = () => cancelled

    void (async () => {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      setLoading(true)
      setError('')
      try {
        await reloadDetail(isCancelled)
        if (!cancelled) {
          setActionError('')
        }
      } catch (e) {
        if (cancelled) {
          return
        }
        setDetail(null)
        setDrafts({})
        setSignatureDrafts({})
        if (e instanceof ApiError && e.status === 403) {
          setError('계약서 수신번호 인증이 필요합니다. 목록 화면에서 인증을 완료해 주세요.')
          return
        }
        if (e instanceof ApiError && e.status === 404) {
          setError('문서를 찾을 수 없습니다.')
          return
        }
        setError(e instanceof ApiError ? e.message : '문서를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [linkCode, documentInstanceId, paramsInvalid, reloadDetail])

  const sortedFields = useMemo(() => (detail ? sortFields(detail) : []), [detail])
  const agreementFields = useMemo(() => sortedFields.filter((f) => f.fieldType === 'checkbox'), [sortedFields])
  const inputFields = useMemo(
    () => sortedFields.filter((f) => f.fieldType === 'text' || f.fieldType === 'textarea' || f.fieldType === 'radio'),
    [sortedFields],
  )
  const signatureFields = useMemo(() => sortedFields.filter((f) => f.fieldType === 'signature'), [sortedFields])

  const basicsComplete = detail ? allRequiredFilled(detail, drafts) : false
  const canSubmitSend =
    Boolean(detail && detail.canEdit !== false && detail.document.status !== 'completed') &&
    basicsComplete &&
    finalPreviewConfirmed &&
    finalSubmitAck

  const openOriginalPdfPreview = () => {
    setFinalReviewOpen(false)
    setSigModalField(null)
    setPdfPreviewOpen(true)
  }

  const openSignatureModal = (id: string, label: string) => {
    setPdfPreviewOpen(false)
    setFinalReviewOpen(false)
    setActionError('')
    setSigModalField({ id, label })
  }

  const onSaveValues = async () => {
    if (!detail || detail.canEdit === false) {
      return
    }
    setActionError('')
    setSaving(true)
    try {
      const values: ContractPublicValueInput[] = []
      for (const f of detail.fields) {
        if (f.fieldType === 'signature') {
          continue
        }
        const raw = drafts[f.id]
        if (f.fieldType === 'checkbox') {
          values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: Boolean(raw) })
          continue
        }
        values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: raw == null ? '' : String(raw) })
      }
      await postContractPublicDocumentValues(linkCode, documentInstanceId, values)
      await reloadDetail()
    } catch (e) {
      setActionError(formatContractPublicActionError(e, 'values'))
    } finally {
      setSaving(false)
    }
  }

  const onOpenFinalReview = async () => {
    if (!detail || detail.canEdit === false) {
      return
    }
    if (!basicsComplete) {
      setActionError('필수 입력·동의·전자서명을 모두 완료한 뒤 최종 확인을 진행해 주세요.')
      return
    }
    setActionError('')
    setSaving(true)
    try {
      const values: ContractPublicValueInput[] = []
      for (const f of detail.fields) {
        if (f.fieldType === 'signature') {
          continue
        }
        const raw = drafts[f.id]
        if (f.fieldType === 'checkbox') {
          values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: Boolean(raw) })
          continue
        }
        values.push({ fieldId: f.id, fieldKey: f.fieldKey, value: raw == null ? '' : String(raw) })
      }
      await postContractPublicDocumentValues(linkCode, documentInstanceId, values)
      await reloadDetail()
    } catch (e) {
      setActionError(formatContractPublicActionError(e, 'values'))
      return
    } finally {
      setSaving(false)
    }
    setPdfPreviewOpen(false)
    setSigModalField(null)
    setFinalReviewLoadNonce((n) => n + 1)
    setFinalReviewOpen(true)
  }

  const onComplete = async () => {
    if (!detail || detail.canEdit === false) {
      return
    }
    if (!canSubmitSend) {
      setActionError('최종 문서 확인과 전송 동의를 완료해 주세요.')
      return
    }
    setActionError('')
    setSaving(true)
    try {
      const data = await postContractPublicDocumentComplete(linkCode, documentInstanceId, {
        acknowledgeElectronicContract: true,
        finalPreviewConfirmed: true,
        finalSubmitAcknowledged: true,
      })
      await reloadDetail()
      setFinalSubmitAck(false)
      setFinalPreviewConfirmed(false)
      const ev = data.evidenceSummary
      const completedAt = ev?.completedAt ?? ev?.signedAt ?? new Date().toISOString()
      setCompleteResult({
        evidenceSummary: ev,
        signedPdfDownloadPath: data.signedPdfDownloadPath,
        signedPdfDownloadAvailable: data.signedPdfDownloadAvailable,
        completedAt,
      })
      setSuccessOpen(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const pack = e.data as { evidence?: { evidenceHashPrefix?: string | null } | null } | undefined
        const prefix = pack?.evidence?.evidenceHashPrefix
        setActionError(prefix ? `${e.message} (증빙 해시 일부: ${prefix})` : e.message)
      } else {
        setActionError(formatContractPublicCompleteError(e))
      }
    } finally {
      setSaving(false)
    }
  }

  const pdfSrc = !paramsInvalid ? resolveContractPdfPreviewAbsUrl(linkCode, documentInstanceId) : ''
  const renderedPdfSrc = !paramsInvalid ? resolveContractRenderedPdfAbsUrl(linkCode, documentInstanceId) : ''

  let body: ReactNode
  if (paramsInvalid) {
    body = (
      <div className="contract-public-sign-page__panel-danger-soft">
        <p className="text-sm">링크가 올바르지 않습니다.</p>
        <Link
          className="contract-public-sign-page__link contract-public-sign-page__link--after-block"
          to={linkCode ? `/contracts/sign/${encodeURIComponent(linkCode)}` : '/'}
        >
          목록으로
        </Link>
      </div>
    )
  } else if (loading) {
    body = <p className="contract-public-sign-page__loading">불러오는 중…</p>
  } else if (error || !detail) {
    body = (
      <div className="contract-public-sign-page__panel-danger-soft">
        <p className="text-sm">{error || '문서를 표시할 수 없습니다.'}</p>
        <Link className="contract-public-sign-page__link contract-public-sign-page__link--after-block" to={`/contracts/sign/${encodeURIComponent(linkCode)}`}>
          목록으로
        </Link>
      </div>
    )
  } else {
    const canEdit = detail.canEdit !== false && detail.document.status !== 'completed'
    const statusLabel =
      detail.document.status === 'completed'
        ? '전송 완료'
        : detail.document.status === 'signed'
          ? '전자서명 저장됨 (최종 전송 전)'
          : detail.document.status === 'signing'
            ? '작성·서명 진행 중'
            : detail.document.status

    body = (
      <div className="contract-public-sign-page__stack">
        <div className="contract-public-sign-page__card">
          <p className="contract-public-sign-page__card-title">{detail.document.title || '문서'}</p>
          <p className="contract-public-sign-page__meta">
            {detail.document.required ? '필수 문서' : '선택 문서'} · {statusLabel}
          </p>
          {detail.pdfTemplate ? (
            <p className="contract-public-sign-page__caption">
              템플릿: {detail.pdfTemplate.title} ({detail.pdfTemplate.pageCount}페이지)
            </p>
          ) : null}
        </div>

        {detail.document.status === 'completed' && detail.evidenceSummary ? (
          <div className="contract-public-sign-page__panel-success">
            <p className="contract-public-sign-page__panel-success-title">전자서명이 전송되었습니다.</p>
            <p>인증 방식: {detail.evidenceSummary.authenticationLabel}</p>
            {detail.evidenceSummary.completedAt ? <p>완료 시각: {detail.evidenceSummary.completedAt}</p> : null}
            {!detail.evidenceSummary.completedAt && detail.evidenceSummary.signedAt ? (
              <p>서명 시각: {detail.evidenceSummary.signedAt}</p>
            ) : null}
            {detail.evidenceSummary.evidenceHashPrefix ? (
              <p className="contract-public-sign-page__panel-success-note">
                증빙 기록(해시 일부): {detail.evidenceSummary.evidenceHashPrefix}
              </p>
            ) : null}
            {(() => {
              const p = (detail.signedPdfDownloadPath ?? '').trim()
              const can = Boolean(p) && detail.signedPdfDownloadAvailable !== false
              return can ? (
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => void downloadPdfWithCredentials(p).catch(() => {})}
                >
                  최종 계약서 다운로드
                </FormButton>
              ) : (
                <p className="contract-public-sign-page__panel-success-note">
                  최종 PDF 다운로드는 준비 중입니다. 담당자 화면에서 증빙 상태를 확인할 수 있습니다.
                </p>
              )
            })()}
          </div>
        ) : null}

        <div className="contract-public-sign-page__card">
          <p className="contract-public-sign-page__section-label">계약서 원문 확인</p>
          <p className="contract-public-sign-page__notice mt-2">
            계약서 내용을 확인한 뒤 아래 항목을 입력하고 전자서명을 진행해주세요.
          </p>
          {pdfLoadState === 'loading' ? <p className="contract-public-sign-page__notice mt-3">계약서 PDF 불러오는 중…</p> : null}
          {pdfLoadState === 'error' ? (
            <div className="mt-3 space-y-3">
              <p className="contract-public-sign-page__notice">문서 미리보기를 불러오지 못했습니다.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <FormButton htmlType="button" variant="secondary" fullWidth onClick={() => setPdfFetchNonce((n) => n + 1)}>
                  다시 시도
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => window.open(pdfSrc, '_blank', 'noopener,noreferrer')}
                >
                  새 창으로 열기
                </FormButton>
              </div>
            </div>
          ) : null}
          {pdfLoadState === 'ready' && pdfBytes ? (
            <FormButton
              htmlType="button"
              variant="primary"
              fullWidth
              className="mt-4"
              disabled={saving}
              onClick={() => void openOriginalPdfPreview()}
            >
              계약서 원문 크게 보기
            </FormButton>
          ) : null}
          {pdfLoadState === 'idle' ? <p className="contract-public-sign-page__notice mt-3">미리보기 준비 중…</p> : null}
        </div>

        <p className="contract-public-sign-page__notice">{detail.notice}</p>

        {actionError ? <div className="contract-public-sign-page__panel-danger">{actionError}</div> : null}

        {detail.fields.length > 0 ? (
          <div className="contract-public-sign-page__card space-y-4">
            {agreementFields.length > 0 ? (
              <div className="contract-public-sign-page__subsection contract-public-sign-page__subsection--tight space-y-3">
                <p className="contract-public-sign-page__section-label">확인·동의</p>
                {agreementFields.map((f) => {
                  const checked = Boolean(drafts[f.id])
                  return (
                    <label key={f.id} className="contract-public-sign-page__label-row">
                      <FormInput
                        type="checkbox"
                        disabled={!canEdit}
                        checked={checked}
                        onChange={(ev) => {
                          setDrafts((prev) => ({ ...prev, [f.id]: ev.target.checked }))
                          setFinalPreviewConfirmed(false)
                          setFinalSubmitAck(false)
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        {f.label || f.fieldKey}
                        {f.required ? <span className="contract-public-sign-page__required"> *</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}

            {inputFields.length > 0 ? (
              <div className="contract-public-sign-page__subsection contract-public-sign-page__subsection--tight space-y-3">
                <p className="contract-public-sign-page__section-label">문서 입력</p>
                {inputFields.map((f) => {
                  if (f.fieldType === 'radio') {
                    const opts = Array.isArray(f.options) ? f.options.map((x) => String(x)) : []
                    const cur = String(drafts[f.id] ?? '')
                    return (
                      <div key={f.id} className="space-y-1">
                        <p className="contract-public-sign-page__field-label">
                          {f.label || f.fieldKey}
                          {f.required ? <span className="contract-public-sign-page__required"> *</span> : null}
                        </p>
                        <FormSelect
                          disabled={!canEdit}
                          value={cur}
                          options={[{ value: '', label: '선택' }, ...opts.map((o) => ({ value: o, label: o }))]}
                          onChange={(ev) => {
                            setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))
                            setFinalPreviewConfirmed(false)
                            setFinalSubmitAck(false)
                          }}
                          className="w-full"
                        />
                      </div>
                    )
                  }
                  const isTextarea = f.fieldType === 'textarea'
                  const tv = String(drafts[f.id] ?? '')
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="contract-public-sign-page__field-label">
                        {f.label || f.fieldKey}
                        {f.required ? <span className="contract-public-sign-page__required"> *</span> : null}
                      </p>
                      {isTextarea ? (
                        <FormTextarea
                          disabled={!canEdit}
                          value={tv}
                          onChange={(ev) => {
                            setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))
                            setFinalPreviewConfirmed(false)
                            setFinalSubmitAck(false)
                          }}
                          rows={4}
                          className="w-full text-sm"
                        />
                      ) : (
                        <FormInput
                          type="text"
                          disabled={!canEdit}
                          value={tv}
                          onChange={(ev) => {
                            setDrafts((prev) => ({ ...prev, [f.id]: ev.target.value }))
                            setFinalPreviewConfirmed(false)
                            setFinalSubmitAck(false)
                          }}
                          className="w-full text-sm"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {signatureFields.length > 0 ? (
              <div className="contract-public-sign-page__subsection contract-public-sign-page__subsection--tight space-y-3">
                <p className="contract-public-sign-page__section-label">전자서명 (손사인)</p>
                {signatureFields.map((f) => {
                  const signed = f.publicValue?.kind === 'signature' ? f.publicValue.signed : false
                  return (
                    <div key={f.id} className="contract-public-sign-page__sig-row space-y-2">
                      <p className="text-sm text-[var(--text-main)]">
                        {f.label || f.fieldKey}
                        {f.required ? <span className="contract-public-sign-page__required"> *</span> : null}
                        {signed ? (
                          <span className="contract-public-sign-page__success-inline">
                            · 전자서명이 저장되었습니다
                          </span>
                        ) : null}
                      </p>
                      {!canEdit ? null : signed ? (
                        <>
                          <label className="contract-public-sign-page__label-row">
                            <FormInput
                              type="checkbox"
                              checked={signAck}
                              onChange={(ev) => setSignAck(ev.target.checked)}
                              className="mt-0.5"
                            />
                            <span>본인은 본 계약서가 본인에게 발송된 문서임을 확인하고, 전자서명합니다.</span>
                          </label>
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            fullWidth
                            disabled={saving || !signAck}
                            onClick={() => openSignatureModal(f.id, f.label || f.fieldKey)}
                          >
                            다시 서명하기
                          </FormButton>
                        </>
                      ) : (
                        <>
                          <label className="contract-public-sign-page__label-row">
                            <FormInput
                              type="checkbox"
                              checked={signAck}
                              onChange={(ev) => setSignAck(ev.target.checked)}
                              className="mt-0.5"
                            />
                            <span>본인은 본 계약서가 본인에게 발송된 문서임을 확인하고, 전자서명합니다.</span>
                          </label>
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            fullWidth
                            disabled={saving || !signAck}
                            onClick={() => openSignatureModal(f.id, f.label || f.fieldKey)}
                          >
                            전자서명하기
                          </FormButton>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {canEdit ? (
              <div className="contract-public-sign-page__actions-block space-y-3">
                <FormButton htmlType="button" variant="secondary" fullWidth loading={saving} onClick={() => void onSaveValues()}>
                  임시저장
                </FormButton>

                <div className="contract-public-sign-page__final-hint">
                  <p className="contract-public-sign-page__final-hint-title">최종 문서 확인</p>
                  <p className="contract-public-sign-page__final-hint-desc">
                    입력·서명이 반영된 문서를 확인한 뒤에만 전송 단계로 진행할 수 있습니다.
                  </p>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    fullWidth
                    className="mt-3"
                    disabled={saving || !basicsComplete}
                    onClick={() => void onOpenFinalReview()}
                  >
                    최종 문서 확인
                  </FormButton>
                  {finalPreviewConfirmed ? (
                    <p className="contract-public-sign-page__status-ok">최종 문서 확인 완료</p>
                  ) : (
                    <p className="contract-public-sign-page__status-pending">미확인</p>
                  )}
                </div>

                <label className="contract-public-sign-page__label-row">
                  <FormInput
                    type="checkbox"
                    checked={finalSubmitAck}
                    disabled={!finalPreviewConfirmed}
                    onChange={(ev) => setFinalSubmitAck(ev.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    입력한 내용과 전자서명이 최종 문서에 올바르게 반영된 것을 확인했으며, 이 문서를 전송합니다.
                  </span>
                </label>

                <FormButton
                  htmlType="button"
                  variant="primary"
                  fullWidth
                  loading={saving}
                  disabled={!canSubmitSend}
                  onClick={() => void onComplete()}
                >
                  전체 완료 및 전송
                </FormButton>
              </div>
            ) : null}
          </div>
        ) : null}

        <Link className="contract-public-sign-page__link contract-public-sign-page__link--after-block" to={`/contracts/sign/${encodeURIComponent(linkCode)}`}>
          ← 문서 목록
        </Link>

        <PublicPdfPreviewModal
          open={pdfPreviewOpen}
          onClose={() => setPdfPreviewOpen(false)}
          title={detail.document.title || '계약서 미리보기'}
          pdfUrl={pdfSrc}
          initialPdfBytes={pdfLoadState === 'ready' && pdfBytes && pdfBytes.byteLength > 0 ? pdfBytes : null}
          pageCount={Math.max(1, detail.pdfTemplate?.pageCount ?? 1)}
          initialPageNo={1}
          documentInstanceId={documentInstanceId}
        />

        <PublicPdfPreviewModal
          open={finalReviewOpen}
          onClose={() => setFinalReviewOpen(false)}
          title="최종 문서 확인"
          subtitle="입력하신 내용과 전자서명이 올바르게 반영되었는지 확인해주세요."
          pdfUrl={renderedPdfSrc}
          initialPdfBytes={null}
          pageCount={Math.max(1, detail.pdfTemplate?.pageCount ?? 1)}
          initialPageNo={1}
          documentInstanceId={documentInstanceId}
          loadNonce={finalReviewLoadNonce}
          footerSlot={
            <div className="contract-public-sign-page__footer-actions">
              <FormButton htmlType="button" variant="secondary" fullWidth onClick={() => setFinalReviewOpen(false)}>
                수정하기
              </FormButton>
              <FormButton
                htmlType="button"
                variant="primary"
                fullWidth
                onClick={() => {
                  setFinalPreviewConfirmed(true)
                  setFinalSubmitAck(false)
                  setFinalReviewOpen(false)
                }}
              >
                확인했습니다
              </FormButton>
            </div>
          }
        />

        <SignatureModal
          open={sigModalField != null}
          padResetKey={
            sigModalField
              ? `${sigModalField.id}:${signatureDrafts[String(sigModalField.id)] ? 'has' : 'none'}`
              : undefined
          }
          title="전자서명 입력"
          description="손가락 또는 마우스로 서명하세요."
          saveLabel="서명 적용"
          onClose={() => setSigModalField(null)}
          onSave={async (blob) => {
            if (!sigModalField || !detail) {
              return
            }
            if (!signAck) {
              throw new Error('전자서명 진술에 동의해 주세요.')
            }
            const dataUrl = await blobToDataUrl(blob)
            const signatureKey = String(sigModalField.id)
            await postContractPublicDocumentSign(linkCode, documentInstanceId, {
              signatureImageData: dataUrl,
              fieldId: sigModalField.id,
              electronicSignAcknowledged: true,
            })
            setSignatureDrafts((prev) => ({ ...prev, [signatureKey]: dataUrl }))
            setSignAck(false)
            setFinalPreviewConfirmed(false)
            setFinalSubmitAck(false)
            await reloadDetail()
          }}
        />

        {successOpen && completeResult ? (
          <div
            className="contract-public-sign-page__success-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="전송 완료"
          >
            <div className="contract-public-sign-page__success-dialog">
              <h2 className="contract-public-sign-page__success-dialog-title">전자서명이 전송되었습니다.</h2>
              <p className="contract-public-sign-page__success-dialog-lead">
                문서명: <span className="font-medium">{detail.document.title || '문서'}</span>
              </p>
              {completeResult.completedAt ? <p>완료 시각: {completeResult.completedAt}</p> : null}
              {completeResult.evidenceSummary?.evidenceHashPrefix ? (
                <p className="contract-public-sign-page__success-dialog-muted">
                  증빙번호(해시 일부): {completeResult.evidenceSummary.evidenceHashPrefix}
                </p>
              ) : null}
              <p>담당자가 완료된 전자서명 문서를 확인할 수 있습니다.</p>
              <p>이 화면은 닫으셔도 됩니다.</p>
              <p className="contract-public-sign-page__success-dialog-muted">
                카카오톡으로 돌아가려면 상단 닫기 버튼을 눌러주세요.
              </p>
              <div className="contract-public-sign-page__success-dialog-actions">
                {(() => {
                  const path = (completeResult.signedPdfDownloadPath ?? '').trim()
                  const canDl =
                    Boolean(path) &&
                    completeResult.signedPdfDownloadAvailable !== false
                  return canDl ? (
                    <FormButton
                      htmlType="button"
                      variant="primary"
                      fullWidth
                      onClick={() => void downloadPdfWithCredentials(path).catch(() => {})}
                    >
                      최종 계약서 다운로드
                    </FormButton>
                  ) : (
                    <p className="contract-public-sign-page__success-dialog-muted">
                      최종 PDF 다운로드는 준비 중입니다. 담당자 화면에서 증빙 상태를 확인할 수 있습니다.
                    </p>
                  )
                })()}
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setSuccessOpen(false)
                    window.close()
                  }}
                >
                  닫기
                </FormButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="contract-public-sign-page">
      <div className="contract-public-sign-page__inner">
        <h1 className="contract-public-sign-page__h1">계약서 문서</h1>
        {body}
      </div>
    </div>
  )
}
