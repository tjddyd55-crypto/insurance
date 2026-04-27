import type { CustomerImportJob } from '../types/customerImportTypes'

type Props = {
  job: CustomerImportJob | null
}

export function CustomerImportSummary({ job }: Props) {
  if (!job) {
    return <p className="text-sm text-[var(--text-secondary)]">엑셀을 업로드하면 분석 요약이 표시됩니다.</p>
  }
  const cells = [
    ['총 행 수', job.totalRows],
    ['정상', job.readyRows],
    ['미완료', job.incompleteRows],
    ['중복', job.duplicateRows],
    ['오류', job.errorRows],
    ['반영 완료', job.importedRows],
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
      {cells.map(([label, value]) => (
        <div
          key={String(label)}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-soft)] px-3 py-2"
        >
          <div className="text-[var(--text-secondary)]">{label}</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
        </div>
      ))}
    </div>
  )
}
