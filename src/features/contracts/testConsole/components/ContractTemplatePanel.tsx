import { FormButton, FormInput } from '../../../../components/form'
import type { ContractTemplateListItem } from '../contractSignatureTestConsoleClient'

type Props = {
  pdfTemplateId: number | null
  pdfTitle: string | null
  templates: ContractTemplateListItem[]
  selectedContractId: string | null
  onSelectContract: (id: string) => void
  busy: boolean
  onCreateTest: () => void
  onActivate: (id: string) => void
  error: string | null
}

export function ContractTemplatePanel({
  pdfTemplateId,
  pdfTitle,
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

  return (
    <div>
      {error ? (
        <div style={{ color: '#b91c1c', marginBottom: 8, fontSize: 13 }} role="alert">
          {error}
        </div>
      ) : null}
      {!canPick ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>먼저 PDF 템플릿을 선택하세요.</p>
      ) : linked.length === 0 ? (
        <div>
          <p style={{ fontSize: 13 }}>
            이 PDF에 연결된 <code>contract_template</code>이 없습니다. 테스트용 초안을 만들 수 있습니다.
          </p>
          <FormButton htmlType="button" variant="primary" size="sm" disabled={busy} onClick={onCreateTest}>
            [TEST] 계약서 템플릿 생성
          </FormButton>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            제목은 자동으로 <strong>[TEST]</strong> 접두어가 붙습니다. (예: [TEST] {pdfTitle ?? '…'})
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
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
                  <td>{t.status}</td>
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
                      <span style={{ color: 'var(--text-secondary)' }}>active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <FormButton htmlType="button" variant="action" size="sm" className="p-0" disabled={busy} onClick={onCreateTest}>
            + 또 다른 [TEST] 템플릿 만들기
          </FormButton>
        </div>
      )}
    </div>
  )
}
