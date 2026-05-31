import type { FormEvent } from 'react'
import type { CustomerConsultationRow } from '../../api/customerExtraApi'

/** PC 상담 View — inline 추가/수정 폼 */
export type CustomerConsultationsPCViewProps = {
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

/** Mobile 상담 View — 목록 + 추가/수정 모달 */
export type CustomerConsultationsMobileViewProps = {
  listError: string
  formError: string
  busy: boolean
  rows: CustomerConsultationRow[]
  formModalOpen: boolean
  formModalTitle: '상담 추가' | '상담 수정'
  formConsultDate: string
  formBody: string
  formContactResult: string
  onOpenAddModal: () => void
  onOpenEditModal: (row: CustomerConsultationRow) => void
  onCloseFormModal: () => void
  onSetFormConsultDate: (value: string) => void
  onSetFormBody: (value: string) => void
  onSetFormContactResult: (value: string) => void
  onSaveForm: () => void | Promise<void>
  onDelete: (consultId: number) => void | Promise<void>
  onAddTodoFromConsultation?: (consultId: number, plainBody: string) => void
}

/** @deprecated PC/Mobile 분리 — PC는 CustomerConsultationsPCViewProps 사용 */
export type CustomerConsultationsViewProps = CustomerConsultationsPCViewProps
