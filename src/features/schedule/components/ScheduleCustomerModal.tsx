import { useEffect, useRef, useState } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { Button } from '../../../components/ui'
import { ApiError } from '../../../lib/apiClient'
import { getCustomerById } from '../../customers/api/customersApi'
import { scheduleCustomerEmbedSrc, type ScheduleCustomerTarget } from '../domain/scheduleCustomerTarget'

type Status = 'checking' | 'ready' | 'missing' | 'forbidden' | 'error' | 'left'

const CUSTOMER_PATH = /^\/customers\/\d+(?:\/|$)/

const MESSAGES: Record<Exclude<Status, 'checking' | 'ready'>, string> = {
  missing: '고객 정보를 찾을 수 없습니다. 삭제되었거나 연결이 끊긴 고객입니다.',
  forbidden: '이 고객 정보를 볼 권한이 없습니다.',
  error: '고객 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  left: '고객 상세 화면을 표시할 수 없습니다.',
}

/**
 * 기존 고객 상세 화면(좌측 고객 정보 + 우측 탭 전체)을 그대로 띄우는 큰 팝업.
 * 고객 목록·검색은 임베드 표시(customerEmbedMode)로 숨긴다. 권한은 기존 고객 API 가 판단한다.
 * 일정 화면은 뒤에 그대로 남아 있어 닫으면 보던 달·선택 날짜·필터·스크롤이 유지된다.
 */
export default function ScheduleCustomerModal({ token, target, onClose }: {
  token: string
  target: ScheduleCustomerTarget | null
  onClose: () => void
}) {
  // 확인 결과는 고객 id 와 같이 둔다. 다른 고객을 열면 자동으로 '확인 중'.
  const [checked, setChecked] = useState<{ id: number; status: Status } | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const customerId = target?.customerId ?? null
  const status: Status = checked && checked.id === customerId ? checked.status : 'checking'
  const setStatus = (next: Status) => { if (customerId != null) setChecked({ id: customerId, status: next }) }

  useEffect(() => {
    if (customerId == null) return
    let cancelled = false
    const id = customerId
    void getCustomerById(token, id)
      .then((customer) => { if (!cancelled) setChecked({ id, status: customer ? 'ready' : 'missing' }) })
      .catch((error: unknown) => {
        if (cancelled) return
        const code = error instanceof ApiError ? error.status : 0
        setChecked({ id, status: code === 403 ? 'forbidden' : code === 404 ? 'missing' : 'error' })
      })
    return () => { cancelled = true }
  }, [customerId, token])

  // 고객 상세가 자체 판단으로 목록 등 다른 화면으로 옮기면(권한 없음·삭제 등) 목록을 보이지 않고 안내로 바꾼다.
  useEffect(() => {
    if (status !== 'ready') return
    const timer = window.setInterval(() => {
      try {
        const path = frameRef.current?.contentWindow?.location.pathname ?? ''
        if (path && path !== 'blank' && !CUSTOMER_PATH.test(path)) setStatus('left')
      } catch {
        setStatus('left')
      }
    }, 600)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setStatus 는 customerId 기준으로만 바뀐다
  }, [status, customerId])

  if (!target) return null
  const heading = target.customerName ? `${target.customerName} 고객 상세` : '고객 상세'
  return (
    <BaseDialog
      open
      usePortal
      onClose={onClose}
      ariaLabel={heading}
      closeOnBackdrop={false}
      closeOnEsc
      panelClassName="schedule-customer-modal"
    >
      <header className="schedule-customer-modal__head">
        <strong className="schedule-customer-modal__title">{heading}</strong>
        {target.title ? <span className="schedule-customer-modal__sub">{target.title}</span> : null}
        <Button type="button" variant="secondary" size="sm" className="schedule-customer-modal__close" onClick={onClose}>닫기</Button>
      </header>
      <div className="schedule-customer-modal__body">
        {status === 'checking' ? <p className="schedule-customer-modal__message" role="status">고객 정보를 확인하는 중…</p> : null}
        {status === 'ready' ? (
          <iframe
            ref={frameRef}
            className="schedule-customer-modal__frame"
            title={heading}
            src={scheduleCustomerEmbedSrc(target)}
          />
        ) : null}
        {status !== 'checking' && status !== 'ready' ? (
          <p className="schedule-customer-modal__message" role="alert">{MESSAGES[status]}</p>
        ) : null}
      </div>
    </BaseDialog>
  )
}
