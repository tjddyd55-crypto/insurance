import type { FormEvent } from 'react'
import type { CustomerConsultationRow } from '../../api/customerExtraApi'

/**
 * `CustomerConsultationsPagePC` / `CustomerConsultationsPageMobile` 가 **공유**하는
 * View props 시그니처.
 */
export type CustomerConsultationsViewProps = {
  error: string
  body: string
  consultDate: string
  contactResult: string
  busy: boolean
  rows: CustomerConsultationRow[]
  editingConsultId: number | null
  editConsultDate: string
  editConsultBody: string
  editContactResult: string
  onSetBody: (value: string) => void
  onSetConsultDate: (value: string) => void
  onSetContactResult: (value: string) => void
  onStartEdit: (row: CustomerConsultationRow) => void
  onCancelEdit: () => void
  onSetEditConsultDate: (value: string) => void
  onSetEditConsultBody: (value: string) => void
  onSetEditContactResult: (value: string) => void
  onSaveEdit: (consultId: number) => void | Promise<void>
  onSubmit: (e: FormEvent) => void | Promise<void>
  onDelete: (consultId: number) => void | Promise<void>
  onAddTodoFromConsultation?: (consultId: number, plainBody: string) => void
}
