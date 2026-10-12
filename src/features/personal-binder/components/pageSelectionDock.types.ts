import type { PersonalBinder, PersonalBinderMaterial } from '../personalBinder.types'

export type PageSelectionDockState = {
  binder: PersonalBinder
  folderLabel: string
  sectionTitle: string
  material: PersonalBinderMaterial
  pdfUrl: string | null
  initialSelection: number[] | null
  onClose: () => void
  onComplete: (selection: number[] | null) => void
}
