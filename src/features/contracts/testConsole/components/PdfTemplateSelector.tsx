import { FormInput } from '../../../../components/form'
import type { PdfTemplateSummary } from '../../../pdf-engine/types'

export type PdfPickRow = PdfTemplateSummary & {
  fieldCount: number
  signatureCount: number
  loadingDetail: boolean
}

type Props = {
  rows: PdfPickRow[]
  selectedId: number | null
  onSelect: (id: number) => void
  disabled?: boolean
}

export function PdfTemplateSelector({ rows, selectedId, onSelect, disabled }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table table-sm table-striped" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>선택</th>
            <th>템플릿명</th>
            <th>PDF ID</th>
            <th>필드 수</th>
            <th>서명 필드</th>
            <th>활성</th>
            <th>수정일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const noFields = !r.loadingDetail && r.fieldCount < 1
            const noSig = !r.loadingDetail && r.signatureCount < 1
            return (
              <tr key={r.id}>
                <td>
                  <FormInput
                    type="radio"
                    name="pdf-pick"
                    checked={selectedId === r.id}
                    value={String(r.id)}
                    disabled={disabled}
                    onChange={() => onSelect(r.id)}
                  />
                </td>
                <td>
                  {r.title}
                  {noFields ? (
                    <div style={{ color: '#b45309', fontSize: 12 }}>좌표 필드 없음 — active 전환·발송에 제약될 수 있습니다.</div>
                  ) : null}
                  {noSig ? (
                    <div style={{ color: '#b45309', fontSize: 12 }}>signature 필드 없음 — 손사인 단계 테스트가 제한될 수 있습니다.</div>
                  ) : null}
                </td>
                <td>{r.id}</td>
                <td>{r.loadingDetail ? '…' : r.fieldCount}</td>
                <td>{r.loadingDetail ? '…' : r.signatureCount}</td>
                <td>{r.isActive ? '예' : '아니오'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.updatedAt?.slice(0, 19) ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
