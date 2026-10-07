import { FormButton } from '../../../../components/form'
import { buildCustomerPublicSignUrl } from '../../userHistory/contractSignatureHistoryClient'
import { SendSessionStatusBadge } from '../../userHistory/components/SendSessionStatusBadge'
import { staffDocumentStatusLabel } from '../../userHistory/sendSessionStaffDisplay'
import type { CreateSendSessionResult, SendSessionDetail } from '../contractSignatureTestConsoleClient'
import { downloadStaffEvidencePdfFile, downloadStaffSignedPdfFile } from '../contractSignatureTestConsoleClient'

function formatAttachmentCustomerConfirmAt(iso: string | null | undefined): string {
  if (!iso) {
    return ''
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return String(iso).slice(0, 16)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${h}:${min}`
}

type Props = {
  busy: boolean
  lastCreated: CreateSendSessionResult | null
  onCreate: () => void
  canSend: boolean
  /** 선택한 계약서 템플릿이 active가 아닐 때 발송 버튼 비활성 사유 */
  inactiveTemplateHint?: string | null
  detail: SendSessionDetail | null
  onRefresh: () => void
  error: string | null
  /** FC·테스트 콘솔 담당자 토큰 — 있으면 완료 문서 행에 최종 PDF 다운로드 노출 */
  staffAuthToken?: string
  /** 발송 페이지 모바일 스텝용 — 터치·한 줄 요약 */
  layout?: 'desktop' | 'mobile'
}

export function SendSessionPanel({
  busy,
  lastCreated,
  onCreate,
  canSend,
  inactiveTemplateHint,
  detail,
  onRefresh,
  error,
  staffAuthToken,
  layout = 'desktop',
}: Props) {
  const staffTok = staffAuthToken?.trim() ?? ''
  const isMobile = layout === 'mobile'
  const session = detail ?? (lastCreated ? mapLastToDetailShape(lastCreated) : null)
  const sessionCompleted = Boolean(detail?.status === 'completed')
  const consoleIsConfirmation = detail?.templateMode === 'confirmation_only'
  const signedCompleteDocDlLabel = consoleIsConfirmation
    ? '완료 확인서 PDF 다운로드'
    : '완료 계약서 PDF 다운로드'
  const signedCompleteDocPendingLabel = consoleIsConfirmation
    ? '완료 확인서 PDF 준비 중'
    : '완료 계약서 PDF 준비 중'
  const completedDocColumnLabel = consoleIsConfirmation ? '완료 확인서 PDF' : '완료 계약서 PDF'

  const notifyDownloadError = (message: string) => {
    window.alert(message)
  }

  const copyLink = async (linkCode: string) => {
    const url = buildCustomerPublicSignUrl(linkCode)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('링크를 복사하세요', url)
    }
  }

  const openTab = (linkCode: string) => {
    window.open(buildCustomerPublicSignUrl(linkCode), '_blank', 'noopener,noreferrer')
  }

  const renderPostSendActions = () => {
    if (!session) {
      return null
    }
    return (
      <div className="contract-signature-console__session-summary contract-signature-console__session-summary--production">
        <p className="contract-signature-console__body-text" style={{ margin: '0 0 8px' }}>
          전자서명 링크가 발송되었습니다. 고객에게 아래 링크를 전달하거나, 등록된 휴대폰으로 접속할 수 있습니다.
        </p>
        <p className="contract-signature-console__hint" style={{ margin: '0 0 8px' }}>
          연락처: {session.maskedPhone || '—'}
        </p>
        <p className="contract-signature-console__hint" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>상태</span>
          <SendSessionStatusBadge sessionStatus={session.status} />
        </p>
        <div className="contract-signature-console__btn-row">
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void copyLink(session.linkCode)}>
            링크 복사
          </FormButton>
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => openTab(session.linkCode)}>
            링크 열기
          </FormButton>
          <FormButton htmlType="button" variant="primary" size="sm" disabled={busy} onClick={onRefresh}>
            상태 새로고침
          </FormButton>
        </div>
        {session.confirmationItems && session.confirmationItems.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: '0.8125rem' }}>고객 확인 항목</strong>
            <ul className="contract-signature-console__unordered-list" style={{ marginTop: 8 }}>
              {session.confirmationItems.map((c) => (
                <li key={c.id}>
                  <span>{c.label}</span>
                  {c.required ? ' · 필수' : ''}
                  {' — '}
                  {c.checked ? (
                    <span>
                      확인 완료
                      {c.checkedAt ? ` (${formatAttachmentCustomerConfirmAt(c.checkedAt)})` : ''}
                    </span>
                  ) : (
                    <span className="contract-signature-console__hint">미확인</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {session.sendSessionAttachments && session.sendSessionAttachments.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: '0.8125rem' }}>첨부자료 확인</strong>
            <ul className="contract-signature-console__unordered-list" style={{ marginTop: 8 }}>
              {session.sendSessionAttachments.map((a) => (
                <li key={a.id}>
                  <span>{a.displayFilename}</span>
                  {a.required ? ' · 필수' : ''}
                  {' — '}
                  {a.confirmed ? (
                    <span>
                      확인 완료
                      {a.confirmedAt ? ` (${formatAttachmentCustomerConfirmAt(a.confirmedAt)})` : ''}
                    </span>
                  ) : (
                    <span className="contract-signature-console__hint">미확인</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {staffTok && (detail?.documents?.length ?? 0) > 0 ? (
          <div className="contract-signature-console__scroll-x" style={{ marginTop: 14 }}>
            <table className="pdf-engine-table contract-signature-console__table--compact">
              <thead>
                <tr>
                  <th>양식명</th>
                  <th>상태</th>
                  <th>{completedDocColumnLabel}</th>
                  <th>증빙 PDF</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.documents ?? []).map((d, idx) => {
                  const ev = d.evidence
                  const canDl = d.status === 'completed' && Boolean(ev?.hasSignedPdfFile)
                  return (
                    <tr key={d.id}>
                      <td>{d.titleSnapshot}</td>
                      <td>{staffDocumentStatusLabel(d.status)}</td>
                      <td>
                        {d.status === 'completed' && canDl ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            className="contract-session-pdf-dl-btn"
                            onClick={() => {
                              if (!detail) {
                                return
                              }
                              void downloadStaffSignedPdfFile(staffTok, detail.id, d.id).then((r) => {
                                if (!r.ok) {
                                  notifyDownloadError(r.message)
                                }
                              })
                            }}
                          >
                            다운로드
                          </FormButton>
                        ) : d.status === 'completed' ? (
                          <span className="contract-signature-console__hint">준비 중</span>
                        ) : (
                          <span className="contract-signature-console__hint">—</span>
                        )}
                      </td>
                      {idx === 0 ? (
                        <td rowSpan={Math.max((detail?.documents ?? []).length, 1)}>
                          {sessionCompleted ? (
                            <FormButton
                              htmlType="button"
                              variant="secondary"
                              size="sm"
                              className="contract-session-pdf-dl-btn"
                              onClick={() => {
                                if (!detail) {
                                  return
                                }
                                void downloadStaffEvidencePdfFile(staffTok, detail.id).then((r) => {
                                  if (!r.ok) {
                                    notifyDownloadError(r.message)
                                  }
                                })
                              }}
                            >
                              다운로드
                            </FormButton>
                          ) : (
                            <span className="contract-signature-console__hint">
                              고객이 문서를 완료하면 다운로드할 수 있습니다.
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div>
        {error ? (
          <div className="contract-signature-console__inline-error" role="alert">
            {error}
          </div>
        ) : null}
        {!canSend && inactiveTemplateHint ? (
          <p className="contract-signature-console__inline-warning" role="status" style={{ margin: '0 0 10px' }}>
            {inactiveTemplateHint}
          </p>
        ) : null}
        <FormButton
          htmlType="button"
          variant="primary"
          size="sm"
          className="contract-mobile-btn-primary-wide"
          disabled={!canSend || busy}
          onClick={onCreate}
        >
          {busy ? '발송 중…' : '전자서명 발송'}
        </FormButton>
        {canSend || !inactiveTemplateHint ? (
          <p className="contract-signature-console__hint" style={{ marginTop: 10 }}>
            선택한 고객에 등록된 휴대폰으로만 링크가 열립니다.
          </p>
        ) : null}
        {session ? renderPostSendActions() : null}
      </div>
    )
  }

  return (
    <div>
      {error ? (
        <div className="contract-signature-console__inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <FormButton htmlType="button" variant="primary" size="sm" disabled={!canSend || busy} onClick={onCreate}>
        {busy ? '발송 중…' : '전자서명 발송'}
      </FormButton>
      {inactiveTemplateHint ? (
        <p className="contract-signature-console__inline-warning" role="status" style={{ margin: '8px 0 0' }}>
          {inactiveTemplateHint}
        </p>
      ) : null}
      <p className="contract-signature-console__hint">
        선택한 고객에 등록된 휴대폰으로만 링크가 열립니다.
      </p>
      {renderPostSendActions()}
    </div>
  )
}

function mapLastToDetailShape(s: CreateSendSessionResult): SendSessionDetail {
  const conf = Array.isArray(s.confirmationItems)
    ? s.confirmationItems.map((c, idx) => ({
        id: c.id,
        label: c.label,
        required: Boolean(c.required),
        sortOrder: idx,
        checked: false,
        checkedAt: null,
      }))
    : undefined
  return {
    id: s.id,
    linkCode: s.linkCode,
    customerId: s.customerId,
    packageId: null,
    status: s.status,
    maskedPhone: s.maskedPhone,
    identitySessionId: null,
    sentByUserId: null,
    sentAt: null,
    createdAt: s.createdAt,
    completedAt: null,
    documents: [],
    sendSessionAttachments: [],
    ...(conf && conf.length > 0 ? { confirmationItems: conf } : {}),
  }
}
