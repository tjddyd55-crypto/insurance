type Props = {
  disabled?: boolean
  onFileSelected: (file: File | null) => void
  selectedName: string
}

export function CustomerImportUploader({ disabled, onFileSelected, selectedName }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="inline-flex">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          disabled={disabled}
          onChange={(ev) => {
            const f = ev.target.files?.[0] ?? null
            onFileSelected(f)
            ev.target.value = ''
          }}
        />
        <span className="button button--secondary cursor-pointer inline-flex items-center px-3 py-2 rounded-md">
          파일 선택
        </span>
      </label>
      {selectedName ? <span className="text-sm text-[var(--text-secondary)]">{selectedName}</span> : null}
    </div>
  )
}
