import { useCallback, useEffect, useState } from 'react'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import type { ContractTemplateDetail, ContractTemplateListItem } from '../contractSignatureTestConsoleClient'
import {
  deleteContractTemplate,
  duplicateContractTemplate,
  fetchContractTemplateDetail,
  patchContractTemplate,
  setContractTemplateStatus,
} from '../contractSignatureTestConsoleClient'

type Props = {
  token: string
  role: string | undefined
  tenantGaId: number | null
  pdfTemplateId: number | null
  pdfTitle: string | null
  pdfSignatureCountByPdfId: ReadonlyMap<number, number>
  templates: ContractTemplateListItem[]
  busy: boolean
  error: string | null
  onBusy: (v: boolean) => void
  onError: (msg: string | null) => void
  onReload: () => Promise<void>
  onCreateTemplate: () => Promise<void>
  onClearPdfFilter: () => void
}

type ModalKind = 'detail' | 'edit' | 'status' | null

function statusLabelShort(status: string): string {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'active':
      return 'active'
    case 'archived':
      return 'archived'
    default:
      return status
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case 'draft':
      return '아직 발송 불가'
    case 'active':
      return '발송 가능'
    case 'archived':
      return '사용 중지'
    default:
      return ''
  }
}

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso || String(iso).trim() === '') {
    return '—'
  }
  return String(iso).slice(0, 19).replace('T', ' ')
}

export function ContractTemplatePanel({
  token,
  role,
  tenantGaId,
  pdfTemplateId,
  pdfTitle,
  pdfSignatureCountByPdfId,
  templates,
  busy,
  error,
  onBusy,
  onError,
  onReload,
  onCreateTemplate,
  onClearPdfFilter,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [modal, setModal] = useState<{ kind: ModalKind; templateId: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<ContractTemplateDetail | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [statusDraft, setStatusDraft] = useState<'draft' | 'active' | 'archived'>('draft')

  const runOp = useCallback(
    async (fn: () => Promise<void>) => {
      onError(null)
      onBusy(true)
      try {
        await fn()
        await onReload()
      } catch (e) {
        onError(e instanceof ApiError ? e.message : '요청 처리에 실패했습니다.')
      } finally {
        onBusy(false)
      }
    },
    [onBusy, onError, onReload],
  )

  useEffect(() => {
    if (!modal || modal.kind !== 'detail') {
      setDetail(null)
      return
    }
    let cancelled = false
    const id = modal.templateId
    setDetailLoading(true)
    setDetail(null)
    void (async () => {
      try {
        const d = await fetchContractTemplateDetail(token, role, id, tenantGaId)
        if (!cancelled) {
          setDetail(d)
        }
      } catch (e) {
        if (!cancelled) {
          onError(e instanceof ApiError ? e.message : '상세를 불러오지 못했습니다.')
          setModal(null)
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modal, token, role, tenantGaId, onError])

  const openEdit = (row: ContractTemplateListItem) => {
    setEditTitle(row.title)
    setEditDescription(row.description ?? '')
    setModal({ kind: 'edit', templateId: row.id })
  }

  const openStatus = (row: ContractTemplateListItem) => {
    const s = row.status
    if (s === 'draft' || s === 'active' || s === 'archived') {
      setStatusDraft(s)
    } else {
      setStatusDraft('draft')
    }
    setModal({ kind: 'status', templateId: row.id })
  }

  const closeModal = () => setModal(null)

  return (
    <>
      {confirmDialog}
      {error ? (
        <div className="contract-signature-console__inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <p className="contract-signature-console__body-text" style={{ marginTop: 0, marginBottom: '0.65rem' }}>
        전자서명 발송용 계약서 템플릿 목록입니다. 각 행의 동작 버튼으로 상세 확인, 수정, 상태 변경을 할 수 있습니다.
      </p>
      <div className="contract-signature-console__filter-row">
        {pdfTemplateId != null ? (
          <>
            <span className="contract-signature-console__body-text">
              현재 &lsquo;{pdfTitle?.trim() ? pdfTitle : `PDF #${pdfTemplateId}`}&rsquo; PDF 기반 템플릿만 표시 중입니다.
            </span>
            <FormButton
              htmlType="button"
              variant="secondary"
              size="sm"
              className="contract-signature-console__filter-btn"
              disabled={busy}
              onClick={() => onClearPdfFilter()}
            >
              필터 해제
            </FormButton>
          </>
        ) : (
          <span className="contract-signature-console__body-text">전체 전자서명 템플릿을 표시 중입니다.</span>
        )}
      </div>

      {pdfTemplateId != null &&
      (pdfSignatureCountByPdfId.get(pdfTemplateId) ?? 0) < 1 &&
      templates.length > 0 ? (
        <div className="contract-signature-console__alert--danger" role="alert" style={{ marginBottom: 10 }}>
          이 PDF에는 서명(signature) 필드가 없습니다. 전자서명 절차에서 고객 서명 단계가 제한되거나 진행 불가할 수 있습니다. PDF
          좌표 편집기에서 손사인 필드를 추가해 주세요.
        </div>
      ) : null}

      <div className="contract-signature-console__toolbar" style={{ marginBottom: 10 }}>
        <FormButton
          htmlType="button"
          variant="primary"
          size="sm"
          disabled={busy || pdfTemplateId == null}
          title={pdfTemplateId == null ? '먼저 원본 PDF 템플릿을 선택하세요.' : undefined}
          onClick={() => void runOp(onCreateTemplate)}
        >
          선택한 PDF로 템플릿 만들기
        </FormButton>
      </div>

      <ul className="contract-signature-console__hint" style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12 }}>
        <li>
          <strong>draft</strong>: 아직 발송 불가
        </li>
        <li>
          <strong>active</strong>: 발송 가능
        </li>
        <li>
          <strong>archived</strong>: 사용 중지
        </li>
      </ul>

      <div className="contract-signature-console__scroll-x contract-signature-console__template-table-wrap">
        <table className="contract-signature-console__template-table pdf-engine-table">
          <colgroup>
            <col className="contract-signature-console__col-title" />
            <col className="contract-signature-console__col-status" />
            <col className="contract-signature-console__col-pdf" />
            <col className="contract-signature-console__col-id" />
            <col className="contract-signature-console__col-date" />
            <col className="contract-signature-console__col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">제목</th>
              <th scope="col">상태</th>
              <th scope="col">연결 PDF</th>
              <th scope="col">계약 템플릿 ID</th>
              <th scope="col">수정일</th>
              <th scope="col">동작</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="contract-signature-console__empty-state-text" style={{ padding: '1rem' }}>
                  표시할 전자서명 템플릿이 없습니다. 1번에서 PDF를 선택한 뒤 &ldquo;선택한 PDF로 템플릿 만들기&rdquo;를 눌러 초안을
                  추가할 수 있습니다.
                </td>
              </tr>
            ) : (
              templates.map((trow) => {
                const pid = trow.pdfTemplateId
                const sigN = pid != null ? (pdfSignatureCountByPdfId.get(pid) ?? 0) : 0
                const noSig = pid != null && sigN < 1
                const canHardDelete =
                  trow.status === 'draft' &&
                  trow.documentInstanceCount < 1 &&
                  trow.packageItemCount < 1
                return (
                  <tr key={trow.id} className="contract-signature-console__template-row">
                    <td>{trow.title}</td>
                    <td>
                      <span className="contract-signature-console__status-badge" title={statusDescription(trow.status)}>
                        {statusLabelShort(trow.status)}
                      </span>
                      <div className="contract-signature-console__hint--flush" style={{ marginTop: 4 }}>
                        {statusDescription(trow.status)}
                      </div>
                    </td>
                    <td>
                      {pid == null ? (
                        <span className="contract-signature-console__muted">—</span>
                      ) : (
                        <>
                          <span>{trow.pdfEngineTitle ?? `PDF #${pid}`}</span>
                          {noSig ? (
                            <div className="contract-signature-console__hint--warning" style={{ marginTop: 4 }}>
                              signature 필드 없음
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: 11 }}>{trow.id}</code>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatUpdatedAt(trow.updatedAt)}</td>
                    <td>
                      <div className="contract-signature-console__template-actions">
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => setModal({ kind: 'detail', templateId: trow.id })}
                        >
                          상세
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => openEdit(trow)}
                        >
                          수정
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => openStatus(trow)}
                        >
                          상태변경
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void runOp(async () => {
                              await duplicateContractTemplate(token, role, trow.id, tenantGaId)
                            })
                          }
                        >
                          복제
                        </FormButton>
                        {trow.status === 'active' ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                const ok = await confirm({
                                  message: '이 템플릿을 사용 중지(archived)할까요?',
                                  confirmLabel: '사용 중지',
                                  cancelLabel: '취소',
                                })
                                if (!ok) {
                                  return
                                }
                                await runOp(async () => {
                                  await setContractTemplateStatus(token, role, trow.id, 'archived', tenantGaId)
                                })
                              })()
                            }
                          >
                            사용중지
                          </FormButton>
                        ) : trow.status === 'archived' ? (
                          <FormButton htmlType="button" variant="secondary" size="sm" disabled>
                            사용중지됨
                          </FormButton>
                        ) : (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            disabled={busy || !canHardDelete}
                            title={
                              !canHardDelete
                                ? '발송 이력이 있거나 패키지에 포함된 초안은 삭제할 수 없습니다. 사용 중지를 이용하세요.'
                                : '템플릿 삭제'
                            }
                            onClick={() =>
                              void (async () => {
                                if (!canHardDelete) {
                                  return
                                }
                                const ok = await confirm({
                                  message: '이 초안 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
                                  confirmLabel: '삭제',
                                  cancelLabel: '취소',
                                  tone: 'danger',
                                })
                                if (!ok) {
                                  return
                                }
                                await runOp(async () => {
                                  await deleteContractTemplate(token, role, trow.id, tenantGaId)
                                })
                              })()
                            }
                          >
                            삭제
                          </FormButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {modal?.kind === 'detail' ? (
        <div
          className="contract-signature-console__detail-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
        >
          <div className="contract-signature-console__detail-dialog" role="dialog" aria-modal="true" aria-label="템플릿 상세">
            <h3 className="contract-signature-console__subsection-title" style={{ marginTop: 0 }}>
              전자서명 템플릿 상세
            </h3>
            {detailLoading ? (
              <p className="contract-signature-console__body-text">불러오는 중…</p>
            ) : detail ? (
              <dl className="contract-signature-console__detail-dl">
                <dt>제목</dt>
                <dd>{detail.title}</dd>
                <dt>상태</dt>
                <dd>
                  {statusLabelShort(detail.status)} — {statusDescription(detail.status)}
                </dd>
                <dt>계약 템플릿 ID</dt>
                <dd>
                  <code>{detail.id}</code>
                </dd>
                <dt>연결 PDF</dt>
                <dd>
                  {detail.pdfEngine?.title ?? (detail.pdfTemplateId != null ? `PDF #${detail.pdfTemplateId}` : '—')}
                </dd>
                <dt>필드 수(계약 템플릿 필드)</dt>
                <dd>{detail.contractTemplateFieldsCount}</dd>
                <dt>설명</dt>
                <dd>{detail.description?.trim() ? detail.description : '—'}</dd>
                <dt>수정일</dt>
                <dd>{formatUpdatedAt(detail.updatedAt)}</dd>
              </dl>
            ) : (
              <p className="contract-signature-console__body-text">표시할 데이터가 없습니다.</p>
            )}
            <div className="contract-signature-console__detail-actions">
              <FormButton htmlType="button" variant="secondary" size="sm" onClick={closeModal}>
                닫기
              </FormButton>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.kind === 'edit' ? (
        <div
          className="contract-signature-console__detail-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
        >
          <div className="contract-signature-console__detail-dialog" role="dialog" aria-modal="true" aria-label="템플릿 수정">
            <h3 className="contract-signature-console__subsection-title" style={{ marginTop: 0 }}>
              전자서명 템플릿 수정
            </h3>
            <div style={{ marginBottom: 10 }}>
              <div className="contract-signature-console__body-text" style={{ marginBottom: 6 }}>
                제목
              </div>
              <FormInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={busy} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div className="contract-signature-console__body-text" style={{ marginBottom: 6 }}>
                설명
              </div>
              <FormTextarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={busy} rows={4} />
            </div>
            <div className="contract-signature-console__detail-actions">
              <FormButton htmlType="button" variant="secondary" size="sm" disabled={busy} onClick={closeModal}>
                취소
              </FormButton>
              <FormButton
                htmlType="button"
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    const title = editTitle.trim()
                    if (!title) {
                      onError('제목을 입력하세요.')
                      return
                    }
                    await runOp(async () => {
                      await patchContractTemplate(token, role, modal.templateId, { title, description: editDescription || null }, tenantGaId)
                      closeModal()
                    })
                  })()
                }
              >
                저장
              </FormButton>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.kind === 'status' ? (
        <div
          className="contract-signature-console__detail-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
        >
          <div className="contract-signature-console__detail-dialog" role="dialog" aria-modal="true" aria-label="상태 변경">
            <h3 className="contract-signature-console__subsection-title" style={{ marginTop: 0 }}>
              상태 변경
            </h3>
            <p className="contract-signature-console__footnote" style={{ marginBottom: 8 }}>
              active는 발송 가능, archived는 사용 중지입니다. active로 두려면 PDF에 좌표 필드가 있어야 합니다.
            </p>
            <FormSelect
              value={statusDraft}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'draft' || v === 'active' || v === 'archived') {
                  setStatusDraft(v)
                }
              }}
              options={[
                { value: 'draft', label: 'draft (아직 발송 불가)' },
                { value: 'active', label: 'active (발송 가능)' },
                { value: 'archived', label: 'archived (사용 중지)' },
              ]}
            />
            <div className="contract-signature-console__detail-actions">
              <FormButton htmlType="button" variant="secondary" size="sm" disabled={busy} onClick={closeModal}>
                취소
              </FormButton>
              <FormButton
                htmlType="button"
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void runOp(async () => {
                    await setContractTemplateStatus(token, role, modal.templateId, statusDraft, tenantGaId)
                    closeModal()
                  })
                }
              >
                적용
              </FormButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
