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
  /** SUPER_ADMIN 등 PDF 좌표 편집기 진입 링크 (없으면 열 숨김) */
  resolveCoordinateEditorHref?: (pdfTemplateId: number) => string | null
}

export function PdfTemplateSelector({
  rows,
  selectedId,
  onSelect,
  disabled,
  resolveCoordinateEditorHref,
}: Props) {
  const showCoordCol = typeof resolveCoordinateEditorHref === 'function'
  return (
    <div className="contract-signature-console__scroll-x">
      <table className="pdf-engine-table contract-signature-console__table--compact contract-signature-console__table--striped">
        <thead>
          <tr>
            <th>선택</th>
            <th>템플릿명</th>
            <th>PDF ID</th>
            <th>필드 수</th>
            <th>서명 필드</th>
            <th>활성</th>
            <th>수정일</th>
            {showCoordCol ? <th>좌표 편집</th> : null}
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
                    <div className="contract-signature-console__hint--warning">좌표 필드 없음 — active 전환·발송에 제약될 수 있습니다.</div>
                  ) : null}
                  {noSig ? (
                    <div className="contract-signature-console__hint--warning">signature 필드 없음 — 손사인 단계 테스트가 제한될 수 있습니다.</div>
                  ) : null}
                </td>
                <td>{r.id}</td>
                <td>{r.loadingDetail ? '…' : r.fieldCount}</td>
                <td>{r.loadingDetail ? '…' : r.signatureCount}</td>
                <td>{r.isActive ? '예' : '아니오'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.updatedAt?.slice(0, 19) ?? '—'}</td>
                {showCoordCol ? (
                  <td>
                    {(() => {
                      const href = resolveCoordinateEditorHref?.(r.id) ?? null
                      return href ? (
                        <a href={href} style={{ color: '#7dd3fc' }}>
                          열기
                        </a>
                      ) : (
                        '—'
                      )
                    })()}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
