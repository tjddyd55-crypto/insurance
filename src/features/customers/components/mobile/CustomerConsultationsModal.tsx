import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import {
  createCustomerConsultation,
  listCustomerConsultations,
  type CustomerConsultationRow,
} from '../../api/customerExtraApi'
import CustomerConsultationsPageMobile from '../../pages/detail/CustomerConsultationsPageMobile'
import { localYmd } from '../../utils/consultationBodyFormat'

type CustomerConsultationsModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerConsultationsModal({
  customerId,
  onClose,
}: CustomerConsultationsModalProps) {
  const { token } = useAuth()
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [body, setBody] = useState('')
  const [consultDate, setConsultDate] = useState(() => localYmd())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token?.trim()) {
      setRows([])
      return
    }
    let cancelled = false
    setBusy(true)
    setError('')
    void listCustomerConsultations(token, customerId, { limit: 100 })
      .then((nextRows) => {
        if (!cancelled) {
          setRows(nextRows)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setRows([])
          setError(loadError instanceof Error ? loadError.message : '상담 내역을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [customerId, token])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token?.trim()) {
        setError('로그인이 필요합니다.')
        return
      }
      const content = body.trim()
      if (!content) {
        setError('상담 내용을 입력해 주세요.')
        return
      }

      setBusy(true)
      setError('')
      try {
        await createCustomerConsultation(token, customerId, content, {
          consultationDate: consultDate,
        })
        const nextRows = await listCustomerConsultations(token, customerId, { limit: 100 })
        setRows(nextRows)
        setBody('')
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : '상담 저장에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [body, consultDate, customerId, token],
  )

  return (
    <div className="mobile-modal-overlay" role="dialog" aria-modal="true" aria-label="상담" onClick={onClose}>
      <style>{`
        .mobile-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
        }
        .mobile-modal {
          position: fixed;
          inset: 0;
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          display: flex;
          flex-direction: column;
          padding-bottom: env(safe-area-inset-bottom);
          animation: slideUp 0.25s ease;
        }
        .mobile-modal-header {
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--app-bg, #0b0f14);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mobile-modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .mobile-modal-content {
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          min-height: 100%;
        }
        .mobile-modal button {
          min-height: 44px;
        }
        @keyframes slideUp {
          from {
            transform: translateY(20%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <FormButton htmlType="button" variant="action" className="mobile-btn" onClick={onClose}>
            닫기
          </FormButton>
          <span>상담</span>
        </div>
        <div className="mobile-modal-body">
          <div className="mobile-modal-content">
            <CustomerConsultationsPageMobile
              error={error}
              body={body}
              consultDate={consultDate}
              busy={busy}
              rows={rows}
              onSetBody={setBody}
              onSetConsultDate={setConsultDate}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
