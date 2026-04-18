import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton } from '../../../components/form'
import useIsMobile from '../../../hooks/useIsMobile'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import {
  createCustomerConsultation,
  deleteCustomerConsultation,
  listCustomerConsultations,
  type CustomerConsultationRow,
} from '../api/customerExtraApi'
import { localYmd } from '../utils/consultationBodyFormat'
import CustomerConsultationsPageMobile from './detail/CustomerConsultationsPageMobile'
import CustomerConsultationsPagePC from './detail/CustomerConsultationsPagePC'

export default function CustomerConsultationsPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const resolvedCustomerId = Number(customerId)
  const { token } = useAuth()
  const isMobile = useIsMobile()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [body, setBody] = useState('')
  const [consultDate, setConsultDate] = useState(() => localYmd())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const validId = Number.isInteger(resolvedCustomerId) && resolvedCustomerId > 0

  useEffect(() => {
    if (!token?.trim() || !validId) {
      return
    }
    setRows([])
  }, [resolvedCustomerId, token, validId])

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setError('')
    setNotFound(false)
    try {
      const c = await listCustomerConsultations(token, resolvedCustomerId, { limit: 100 })
      setRows(c)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setRows([])
        return
      }
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [resolvedCustomerId, token, validId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const onSubmitConsultation = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim() || !validId) {
      return
    }
    const t = body.trim()
    if (!t) {
      setError('상담 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createCustomerConsultation(token, resolvedCustomerId, t, { consultationDate: consultDate })
      setBody('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onDeleteConsultation = async (consultId: number) => {
    if (!token?.trim() || !validId) {
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
    setBusy(true)
    setError('')
    try {
      await deleteCustomerConsultation(token, resolvedCustomerId, consultId)
      setRows((prev) => prev.filter((item) => item.id !== consultId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!validId) {
    return (
      <div className="content-wrapper page-shell">
        <p>잘못된 고객 ID입니다.</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="content-wrapper page-shell">
        <h1 style={{ marginTop: 12 }}>고객을 찾을 수 없음</h1>
        <p style={{ color: 'var(--text-secondary)' }}>삭제되었거나 접근할 수 없는 고객입니다.</p>
        <FormButton htmlType="button" variant="action" style={{ marginTop: 12 }} onClick={() => navigate('/customers')}>
          고객 목록으로
        </FormButton>
      </div>
    )
  }

  return (
    <>
      {isMobile ? (
        <CustomerConsultationsPageMobile
          error={error}
          body={body}
          consultDate={consultDate}
          busy={busy}
          rows={rows}
          onSetBody={setBody}
          onSetConsultDate={setConsultDate}
          onSubmit={onSubmitConsultation}
        />
      ) : (
        <CustomerConsultationsPagePC
          error={error}
          body={body}
          consultDate={consultDate}
          busy={busy}
          rows={rows}
          onSetBody={setBody}
          onSetConsultDate={setConsultDate}
          onSubmit={onSubmitConsultation}
          onDelete={onDeleteConsultation}
        />
      )}
      {confirmDialog}
    </>
  )
}
