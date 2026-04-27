import type { CustomerImportRowStatus } from '../types/customerImportTypes'
import { customerImportRowStatusLabel } from '../utils/customerImportLabels'

const TABS: CustomerImportRowStatus[] = ['ready', 'incomplete', 'duplicate', 'error', 'imported']

type Props = {
  active: CustomerImportRowStatus
  onChange: (t: CustomerImportRowStatus) => void
  counts?: Partial<Record<CustomerImportRowStatus, number>> | null
}

export function CustomerImportStatusTabs({ active, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="가져오기 행 상태">
      {TABS.map((t) => {
        const n = counts?.[t]
        const suffix = n != null ? ` (${n})` : ''
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active === t}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              active === t
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--bg-soft)] text-[var(--text-primary)] border-[var(--border-default)]'
            }`}
            onClick={() => onChange(t)}
          >
            {customerImportRowStatusLabel[t]}
            {suffix}
          </button>
        )
      })}
    </div>
  )
}
