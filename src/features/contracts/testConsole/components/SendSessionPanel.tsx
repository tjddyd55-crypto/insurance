import { FormButton } from '../../../../components/form'
import type { CreateSendSessionResult, SendSessionDetail } from '../contractSignatureTestConsoleClient'
import { downloadStaffSignedPdfFile } from '../contractSignatureTestConsoleClient'

function publicSignUrl(linkCode: string): string {
  if (typeof window === 'undefined') {
    return `/contracts/sign/${linkCode}`
  }
  return `${window.location.origin}/contracts/sign/${linkCode}`
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
}: Props) {
  const staffTok = staffAuthToken?.trim() ?? ''
  const session = detail ?? (lastCreated ? mapLastToDetailShape(lastCreated) : null)

  const copyLink = async (linkCode: string) => {
    const url = publicSignUrl(linkCode)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('링크를 복사하세요', url)
    }
  }

  const openTab = (linkCode: string) => {
    window.open(publicSignUrl(linkCode), '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {error ? (
        <div className="contract-signature-console__inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <FormButton htmlType="button" variant="primary" size="sm" disabled={!canSend || busy} onClick={onCreate}>
        {busy ? '생성 중…' : '발송 세션 생성'}
      </FormButton>
      {inactiveTemplateHint ? (
        <p className="contract-signature-console__inline-warning" role="status" style={{ margin: '8px 0 0' }}>
          {inactiveTemplateHint}
        </p>
      ) : null}
      <p className="contract-signature-console__hint">
        선택한 고객에 등록된 휴대폰으로만 링크가 열립니다. 임의 번호 입력·발송은 할 수 없습니다.
      </p>

      {session ? (
        <div className="contract-signature-console__session-summary">
          <div>
            <strong>sendSessionId</strong>{' '}
            <code style={{ fontSize: 11 }}>{session.id}</code>
          </div>
          <div>
            <strong>linkCode</strong> <code style={{ fontSize: 11 }}>{session.linkCode}</code>
          </div>
          <div>
            <strong>maskedPhone</strong> {session.maskedPhone}
          </div>
          <div>
            <strong>문서 수</strong> {session.documents?.length ?? '—'}
          </div>
          <div>
            <strong>상태</strong> {session.status}
          </div>
          <div>
            <strong>생성일</strong> {session.createdAt?.slice(0, 19) ?? '—'}
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>공개 링크</strong>{' '}
            <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{publicSignUrl(session.linkCode)}</code>
          </div>
          <div className="contract-signature-console__btn-row">
            <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void copyLink(session.linkCode)}>
              링크 복사
            </FormButton>
            <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => openTab(session.linkCode)}>
              새 탭에서 고객 링크 열기
            </FormButton>
            <FormButton htmlType="button" variant="primary" size="sm" disabled={busy} onClick={onRefresh}>
              상태 새로고침
            </FormButton>
          </div>
          {staffTok && (detail?.documents?.length ?? 0) > 0 ? (
            <div className="contract-signature-console__scroll-x" style={{ marginTop: 12 }}>
              <table className="pdf-engine-table contract-signature-console__table--compact">
                <thead>
                  <tr>
                    <th>문서</th>
                    <th>상태</th>
                    <th>최종 PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.documents ?? []).map((d) => {
                    const ev = d.evidence
                    const canDl = d.status === 'completed' && Boolean(ev?.hasSignedPdfFile)
                    return (
                      <tr key={d.id}>
                        <td>{d.titleSnapshot}</td>
                        <td>{d.status}</td>
                        <td>
                          {d.status === 'completed' && canDl ? (
                            <FormButton
                              htmlType="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                detail ? void downloadStaffSignedPdfFile(staffTok, detail.id, d.id) : undefined
                              }
                            >
                              다운로드
                            </FormButton>
                          ) : d.status === 'completed' ? (
                            <span className="contract-signature-console__hint">최종 PDF 준비 중</span>
                          ) : (
                            <span className="contract-signature-console__hint">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function mapLastToDetailShape(s: CreateSendSessionResult): SendSessionDetail {
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
  }
}
