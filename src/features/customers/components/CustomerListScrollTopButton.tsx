import { useCallback, type RefObject } from 'react'
import { scrollCustomerListPanelToTop } from '../utils/resolveCustomerListScrollContainer'

type CustomerListScrollTopButtonProps = {
  anchorRef: RefObject<HTMLElement | null>
}

export default function CustomerListScrollTopButton({ anchorRef }: CustomerListScrollTopButtonProps) {
  const handleClick = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      return
    }
    scrollCustomerListPanelToTop(anchor)
  }, [anchorRef])

  return (
    <button
      type="button"
      className="customer-list-scroll-top-button"
      aria-label="고객 리스트 상단으로 이동"
      title="상단으로 이동"
      onClick={handleClick}
    >
      ⌃
    </button>
  )
}
