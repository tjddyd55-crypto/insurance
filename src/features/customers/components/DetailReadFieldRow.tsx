import type { ReactNode } from 'react'

export type DetailReadFieldRowProps = {
  label: string
  children: ReactNode
  className?: string
}

/** Native-style label/value read row (PC accordion + embedded quick sections). */
export function DetailReadFieldRow({ label, children, className }: DetailReadFieldRowProps) {
  return (
    <div className={`customer-detail-read__field-row${className ? ` ${className}` : ''}`}>
      <span className="customer-detail-read__field-label">{label}</span>
      <div className="customer-detail-read__field-value">{children}</div>
    </div>
  )
}
