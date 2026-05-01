import { FormButton, FormInput } from '../../../../components/form'
import type { ContractTemplateListItem } from '../contractSignatureTestConsoleClient'

type Props = {
  pdfTemplateId: number | null
  pdfTitle: string | null
  pdfSignatureFieldCount?: number
  templates: ContractTemplateListItem[]
  selectedContractId: string | null
  onSelectContract: (id: string) => void
  busy: boolean
  onCreateTest: () => void
  onActivate: (id: string) => void
  error: string | null
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'draft (아직 발송 불가)'
    case 'active':
      return 'active (발송 가능)'
    case 'archived':
      return 'archived (사용 중지)'
    default:
      return status
  }
}

export function ContractTemplatePanel({
  pdfTemplateId,
  pdfTitle,
  pdfSignatureFieldCount = 0,
  templates,
  selectedContractId,
  onSelectContract,
  busy,
  onCreateTest,
  onActivate,
  error,
}: Props) {
  const linked = pdfTemplateId
    ? templates.filter((t) => t.pdfTemplateId === pdfTemplateId)
    : []
  const canPick = pdfTemplateId != null
  const titleExample =
    (pdfTitle ?? '').trim() ? `${(pdfTitle ?? '').trim()} 전자서명 템플릿` : '계약서 전자서명 템플릿'

  return (
    <div>
      {error ? (
        <div className="contract-signature-console__inline-error" role="alert">
          {error}
        </div>
      ) : null}
      {!canPick ? (
        <p className="contract-signature-console__hint contract-signature-console__hint--flush">
          먼저 PDF 템플릿을 선택하세요.
        </p>
      ) : linked.length === 0 ? (
        <div>
          <p style={{ fontSize: 13 }}>
            이 PDF에 연결된 계약서 템플릿이 없습니다. 전자서명 발송용 초안을 만들 수 있습니다.
          </p>
          <FormButton htmlType="button" variant="primary" size="sm" disabled={busy} onClick={onCreateTest}>
            전자서명용 계약서 템플릿 만들기
          </FormButton>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            생성 시 제목 예: <strong>{titleExample}</strong>
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {pdfSignatureFieldCount < 1 ? (
            <div className="contract-signature-console__alert--danger" role="alert" style={{ marginBottom: 10 }}>
              이 PDF에는 서명(signature) 필드가 없습니다. 전자서명 절차에서 고객 서명단계가 제한되거나 진행 불가할 수 있습니다.
              PDF 좌표 편집기에서 손사인 필드를 추가해 주세요.
            </div>
          ) : null}
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
          <table className="table table-sm" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>선택</th>
                <th>제목</th>
                <th>상태</th>
                <th>계약 템플릿 ID</th>
                <th>동작</th>
              </tr>
            </thead>
            <tbody>
              {linked.map((t) => (
                <tr key={t.id}>
                  <td>
                    <FormInput
                      type="radio"
                      name="ct-pick"
                      checked={selectedContractId === t.id}
                      value={t.id}
                      disabled={busy}
                      onChange={() => onSelectContract(t.id)}
                    />
                  </td>
                  <td>{t.title}</td>
                  <td>{statusLabel(t.status)}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{t.id}</code>
                  </td>
                  <td>
                    {t.status !== 'active' ? (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => onActivate(t.id)}
                      >
                        active로 전환
                      </FormButton>
                    ) : (
                      <span className="contract-signature-console__muted">active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <FormButton htmlType="button" variant="action" size="sm" className="p-0" disabled={busy} onClick={onCreateTest}>
            + 전자서명용 계약서 템플릿 만들기
          </FormButton>
        </div>
      )}
    </div>
  )
}
