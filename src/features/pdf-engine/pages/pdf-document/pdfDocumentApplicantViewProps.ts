import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { PdfFieldSpec, PdfTemplateSummary } from '../../types'

export type PdfDocumentApplicantViewProps = {
  template: PdfTemplateSummary
  fields: PdfFieldSpec[]
  pdfBuffer: ArrayBuffer | null
  values: Record<string, string>
  fontOverrides: Record<string, number>
  focusedFieldKey: string | null
  prefillBanner: ReactNode | null
  submitting: boolean
  onChangeValues: Dispatch<SetStateAction<Record<string, string>>>
  onChangeFontOverrides: Dispatch<SetStateAction<Record<string, number>>>
  onFocusedFieldChange: (key: string | null) => void
  onSubmitApplicant: (
    values: Record<string, string>,
    fontOverrides: Record<string, number>,
  ) => Promise<void> | void
}
