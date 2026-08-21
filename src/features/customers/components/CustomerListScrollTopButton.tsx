import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import {
  CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
  CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
} from '../config/customerRecentRegistration.config'
import { computeCustomerListFabFixedPosition } from '../utils/resolveCustomerListFabPosition'
import {
  resolveCustomerListScrollContainer,
  resolveCustomerListViewportAnchor,
  scrollCustomerListPanelToTop,
} from '../utils/resolveCustomerListScrollContainer'

type CustomerListScrollTopButtonProps = {
  anchorRef: RefObject<HTMLElement | null>
  variant?: 'pc' | 'mobile'
}

export default function CustomerListScrollTopButton({
  anchorRef,
  variant = 'pc',
}: CustomerListScrollTopButtonProps) {
  const [fabStyle, setFabStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const syncFabPosition = useCallback(() => {
    const panel = anchorRef.current
    if (!panel || !panel.isConnected) {
      setFabStyle({ visibility: 'hidden' })
      return
    }

    // 위치는 viewport anchor(left). scroll owner 와 달라도 된다.
    const viewport =
      resolveCustomerListViewportAnchor(panel) ?? resolveCustomerListScrollContainer(panel)
    if (!viewport) {
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const next = computeCustomerListFabFixedPosition({
      containerRect: viewport.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      fabWidth: variant === 'mobile' ? 40 : CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
      fabHeight: variant === 'mobile' ? 44 : CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
    })
    setFabStyle(next ?? { visibility: 'hidden' })
  }, [anchorRef, variant])

  useLayoutEffect(() => {
    syncFabPosition()

    const panel = anchorRef.current
    const viewport = panel
      ? resolveCustomerListViewportAnchor(panel) ?? resolveCustomerListScrollContainer(panel)
      : null
    const scrollOwner = panel ? resolveCustomerListScrollContainer(panel) : null

    window.addEventListener('resize', syncFabPosition)
    window.addEventListener('scroll', syncFabPosition, true)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncFabPosition()
          })
        : null

    if (viewport && resizeObserver) {
      resizeObserver.observe(viewport)
    }
    if (scrollOwner && scrollOwner !== viewport && resizeObserver) {
      resizeObserver.observe(scrollOwner)
    }
    if (panel && resizeObserver) {
      resizeObserver.observe(panel)
    }

    return () => {
      window.removeEventListener('resize', syncFabPosition)
      window.removeEventListener('scroll', syncFabPosition, true)
      resizeObserver?.disconnect()
    }
  }, [anchorRef, syncFabPosition])

  const handleClick = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor || !anchor.isConnected) {
      return
    }
    // 클릭 순간 fresh resolve
    scrollCustomerListPanelToTop(anchor)
  }, [anchorRef])

  return (
    <div className="customer-list-panel__fab-overlay" aria-hidden={fabStyle.visibility === 'hidden'}>
      <button
        type="button"
        className={[
          'customer-list-scroll-top-button',
          variant === 'mobile' ? 'customer-list-scroll-top-button--mobile' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={fabStyle}
        aria-label="고객 리스트 상단으로 이동"
        title="상단으로 이동"
        onClick={handleClick}
      >
        <span className="customer-list-scroll-top-button__icon" aria-hidden="true">
          ↑
        </span>
      </button>
    </div>
  )
}
