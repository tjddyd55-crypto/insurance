import type { CrmTemplateDraft } from '../crmTemplateBuilder.types'
import { sampleListCellValue } from './crmTemplatePreviewSampleValues'

type Props = {
  draft: CrmTemplateDraft
}

/** 목록(테이블) 미리보기 — 샘플 데이터만 표시 */
export default function CrmTemplateListPreview({ draft }: Props) {
  const columns = draft.listColumns.filter((c) => c.visibleDefault !== false)
  if (columns.length === 0) {
    return <p className="platform-admin-page__muted text-sm">목록 컬럼을 추가하면 테이블 미리보기가 표시됩니다.</p>
  }

  return (
    <div className="crm-template-builder__preview-list-wrap">
      <table className="crm-template-builder__preview-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.localId}>{c.label.trim() || '컬럼'}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((c) => (
              <td key={c.localId}>{sampleListCellValue(c, draft.formFields)}</td>
            ))}
          </tr>
          <tr className="crm-template-builder__preview-table-row--muted">
            {columns.map((c) => (
              <td key={`${c.localId}-2`}>{sampleListCellValue(c, draft.formFields)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="crm-template-builder__preview-list-cards">
        {columns.map((c) => (
          <article key={c.localId} className="crm-template-builder__preview-mock-card">
            <div className="crm-template-builder__preview-mock-line2 platform-admin-page__muted text-xs mb-1">
              {c.label.trim() || '컬럼'}
            </div>
            <div className="crm-template-builder__preview-mock-line1">
              {sampleListCellValue(c, draft.formFields)}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
