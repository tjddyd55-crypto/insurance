import type { ReactNode } from 'react'

import FormButton from '../../../../components/form/FormButton'

type Props = {
  className: string
  title: string
  readOnly: boolean
  onEdit: () => void
  tools: ReactNode
  children: ReactNode
}

export function AltRowFrame({ className, title, readOnly, onEdit, tools, children }: Props) {
  return (
    <div className={className} data-testid="coverage-alt-row">
      {readOnly ? null : (
        <FormButton variant="action" className="cs-alt-row__hit" aria-label={`${title} 수정`} onClick={onEdit}>
          {null}
        </FormButton>
      )}
      {children}
      {readOnly ? <span className="cs-alt-row__tools" aria-hidden="true" /> : tools}
    </div>
  )
}
