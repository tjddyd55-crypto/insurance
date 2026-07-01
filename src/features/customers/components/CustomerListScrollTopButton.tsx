import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import {
  CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR,
  CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
  CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
} from '../config/customerRecentRegistration.config'
import { resolveCustomerListScrollFabBottomOffsetPx } from '../utils/resolveCustomerListFloatingBottom'
import {
  resolveCustomerListScrollContainer,
  scrollCustomerListPanelToTop,
} from '../utils/resolveCustomerListScrollContainer'

type CustomerListScrollTopButtonProps = {
  anchorRef: RefObject<HTMLElement | null>
}

export default function CustomerListScrollTopButton({ anchorRef }: CustomerListScrollTopButtonProps) {
  const [fabStyle, setFabStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const syncFabPosition = useCallback(() => {
    const panel = anchorRef.current
    if (!panel || !panel.isConnected) {
      document.documentElement.style.removeProperty(CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR)
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const container = resolveCustomerListScrollContainer(panel)
    if (!container) {
      document.documentElement.style.removeProperty(CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR)
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const rect = container.getBoundingClientRect()
    if (rect.width < CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX || rect.height < CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX) {
      document.documentElement.style.removeProperty(CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR)
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const bottomOffsetPx = resolveCustomerListScrollFabBottomOffsetPx(panel)
    document.documentElement.style.setProperty(
      CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR,
      `${bottomOffsetPx}px`,
    )

    setFabStyle({
      position: 'fixed',
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 50,
      visibility: 'visible',
    })
  }, [anchorRef])

  useLayoutEffect(() => {
    syncFabPosition()

    const panel = anchorRef.current
    const container = panel ? resolveCustomerListScrollContainer(panel) : null

    window.addEventListener('resize', syncFabPosition)
    window.addEventListener('scroll', syncFabPosition, true)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncFabPosition()
          })
        : null

    if (container && resizeObserver) {
      resizeObserver.observe(container)
    }
    if (panel && resizeObserver) {
      resizeObserver.observe(panel)
    }

    return () => {
      window.removeEventListener('resize', syncFabPosition)
      window.removeEventListener('scroll', syncFabPosition, true)
      resizeObserver?.disconnect()
      document.documentElement.style.removeProperty(CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_CSS_VAR)
    }
  }, [anchorRef, syncFabPosition])

  const handleClick = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      return
    }
    scrollCustomerListPanelToTop(anchor)
  }, [anchorRef])

  return (
    <div className="customer-list-panel__fab-overlay" aria-hidden={fabStyle.visibility === 'hidden'}>
      <button
        type="button"
        className="customer-list-scroll-top-button"
        style={fabStyle}
        aria-label="고객 리스트 상단으로 이동"
        title="상단으로 이동"
        onClick={handleClick}
      >
        ↑
      </button>
    </div>
  )
}
