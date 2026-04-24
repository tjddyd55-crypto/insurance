import { useMemo } from 'react'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { FormButton } from '../../../../components/form'
import Modal from '../../../../components/ui/Modal'
import type { CustomerWorkspaceLayoutPCProps } from './CustomerWorkspaceLayoutPC'

function resolveMobileSheetTitle(pathname: string, search: string): string {
  if (pathname.includes('/claim-requests')) {
    const tab = new URLSearchParams(search).get('claimTab')
    return tab === 'news-personal' ? '개인메시지' : '청구 관리'
  }
  if (pathname.includes('/consultations')) {
    return '상담'
  }
  if (pathname.includes('/ga-excel') || pathname.includes('/ga')) {
    return 'GA 데이터 보기'
  }
  if (pathname.includes('/auto-form')) {
    return '자동차 신청서'
  }
  if (pathname.includes('/memos')) {
    return '메모'
  }
  if (pathname.includes('/files')) {
    return '고객 파일'
  }
  return '상세'
}

export default function CustomerWorkspaceLayoutMobile(props: CustomerWorkspaceLayoutPCProps) {
  const outlet = useOutlet()
  const navigate = useNavigate()
  const location = useLocation()

  const isMobileDetailRoute = useMemo(
    () => /^\/customers\/\d+\/(?:files|consultations|ga-excel|memos|auto-form|claim-requests)(?:\/|$)/.test(location.pathname),
    [location.pathname],
  )

  if (!isMobileDetailRoute || !outlet) {
    return null
  }

  const title = resolveMobileSheetTitle(location.pathname, location.search)

  const handleClose = () => {
    if (props.selectedCustomerId) {
      navigate(`/customers?customerId=${props.selectedCustomerId}`, { replace: true })
      return
    }
    navigate('/customers', { replace: true })
  }

  return (
    <Modal
      open
      onClose={handleClose}
      ariaLabel={title}
      panelClassName="workspace-mobile-outlet-modal"
    >
      <div className="workspace-mobile-outlet-modal__header">
        <span className="workspace-mobile-outlet-modal__spacer" aria-hidden />
        <h2 className="workspace-mobile-outlet-modal__title">{title}</h2>
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          className="workspace-mobile-outlet-modal__close"
          onClick={handleClose}
        >
          닫기
        </FormButton>
      </div>
      <div className="workspace-mobile-outlet-modal__body">{outlet}</div>
    </Modal>
  )
}
