import { useCallback, useEffect, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import {
  createCustomerConsultation,
  deleteCustomerConsultation,
  listCustomerConsultations,
  updateCustomerConsultation,
  type CustomerConsultationRow,
} from '../api/customerExtraApi'
import { normalizeContactResult } from '../config/customerConsultationFollowUp.config'
import type { CustomerConsultationsMobileViewProps } from '../pages/detail/customerConsultationsViewProps'
import { localYmd, normalizeDateForDateInput, parseConsultationStoredBody } from '../utils/consultationBodyFormat'
import { dispatchCustomersListRefresh } from '../utils/customerListRefresh'

function emptyContactResultToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

type UseMobileConsultationsStateOptions = {
  onCreated?: (row: CustomerConsultationRow) => void
  onDeleted?: (consultId: number) => void
}

export function useMobileConsultationsState(
  customerId: number,
  token: string | null | undefined,
  options: UseMobileConsultationsStateOptions = {},
) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [listError, setListError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formModalTitle, setFormModalTitle] = useState<'상담 추가' | '상담 수정'>('상담 추가')
  const [editingConsultId, setEditingConsultId] = useState<number | null>(null)
  const [formConsultDate, setFormConsultDate] = useState(() => localYmd())
  const [formBody, setFormBody] = useState('')
  const [formContactResult, setFormContactResult] = useState('')

  const resetFormFields = useCallback(() => {
    setFormConsultDate(localYmd())
    setFormBody('')
    setFormContactResult('')
    setFormError('')
    setEditingConsultId(null)
  }, [])

  const closeFormModal = useCallback(() => {
    setFormModalOpen(false)
    resetFormFields()
  }, [resetFormFields])

  const loadRows = useCallback(async () => {
    if (!token?.trim()) {
      setRows([])
      return
    }
    setListError('')
    try {
      const nextRows = await listCustomerConsultations(token, customerId, { limit: 100 })
      setRows(nextRows)
    } catch (loadError) {
      setRows([])
      setListError(loadError instanceof Error ? loadError.message : '상담 내역을 불러오지 못했습니다.')
    }
  }, [customerId, token])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    void loadRows()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadRows])

  const openAddModal = useCallback(() => {
    resetFormFields()
    setFormModalTitle('상담 추가')
    setFormModalOpen(true)
  }, [resetFormFields])

  const openEditModal = useCallback((row: CustomerConsultationRow) => {
    const { text } = parseConsultationStoredBody(row.body, row.createdAt, row.consultationDate ?? null)
    setFormError('')
    setFormModalTitle('상담 수정')
    setEditingConsultId(row.id)
    setFormConsultDate(normalizeDateForDateInput(row.consultationDate) ?? localYmd())
    setFormBody(text)
    setFormContactResult(normalizeContactResult(row.contactResult))
    setFormModalOpen(true)
  }, [])

  const onDelete = useCallback(
    async (consultId: number) => {
      if (!token?.trim()) {
        setListError('로그인이 필요합니다.')
        return
      }
      const confirmed = await confirm({
        title: '상담 삭제',
        message: '정말 삭제하시겠습니까?',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!confirmed) {
        return
      }
      if (formModalOpen && editingConsultId === consultId) {
        closeFormModal()
      }
      setBusy(true)
      setListError('')
      try {
        await deleteCustomerConsultation(token, customerId, consultId)
        setRows((prev) => prev.filter((item) => item.id !== consultId))
        options.onDeleted?.(consultId)
        dispatchCustomersListRefresh()
      } catch (deleteError) {
        setListError(deleteError instanceof Error ? deleteError.message : '삭제에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [closeFormModal, confirm, customerId, editingConsultId, formModalOpen, options, token],
  )

  const onSaveForm = useCallback(async () => {
    if (!token?.trim()) {
      setFormError('로그인이 필요합니다.')
      return
    }
    const content = formBody.trim()
    if (!content) {
      setFormError('상담 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      if (formModalTitle === '상담 추가') {
        const created = await createCustomerConsultation(token, customerId, content, {
          consultationDate: formConsultDate,
          contactResult: emptyContactResultToNull(formContactResult),
        })
        options.onCreated?.(created)
      } else if (editingConsultId != null) {
        await updateCustomerConsultation(token, customerId, editingConsultId, {
          body: content,
          consultationDate: formConsultDate,
          contactResult: emptyContactResultToNull(formContactResult),
        })
      }
      await loadRows()
      dispatchCustomersListRefresh()
      closeFormModal()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [
    closeFormModal,
    customerId,
    editingConsultId,
    formBody,
    formConsultDate,
    formContactResult,
    formModalTitle,
    loadRows,
    options,
    token,
  ])

  const mobileViewProps: CustomerConsultationsMobileViewProps = {
    listError,
    formError,
    busy,
    rows,
    formModalOpen,
    formModalTitle,
    formConsultDate,
    formBody,
    formContactResult,
    onOpenAddModal: openAddModal,
    onOpenEditModal: openEditModal,
    onCloseFormModal: closeFormModal,
    onSetFormConsultDate: setFormConsultDate,
    onSetFormBody: setFormBody,
    onSetFormContactResult: setFormContactResult,
    onSaveForm: onSaveForm,
    onDelete,
  }

  return {
    mobileViewProps,
    confirmDialog,
    closeFormModal,
  }
}
