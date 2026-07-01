import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import {
  resolveCustomerListScrollContainer,
  scrollCustomerListPanelToTop,
} from '../utils/resolveCustomerListScrollContainer'

type CustomerListScrollTopButtonProps = {
  anchorRef: RefObject<HTMLElement | null>
}

const FAB_SIZE_PX = 44
const FAB_BOTTOM_OFFSET_PX = 16

export default function CustomerListScrollTopButton({ anchorRef }: CustomerListScrollTopButtonProps) {
  const [fabStyle, setFabStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const syncFabPosition = useCallback(() => {
    const panel = anchorRef.current
    if (!panel || !panel.isConnected) {
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const container = resolveCustomerListScrollContainer(panel)
    if (!container) {
      setFabStyle({ visibility: 'hidden' })
      return
    }

    const rect = container.getBoundingClientRect()
    if (rect.width < FAB_SIZE_PX || rect.height < FAB_SIZE_PX) {
      setFabStyle({ visibility: 'hidden' })
      return
    }

    setFabStyle({
      position: 'fixed',
      left: rect.left + rect.width / 2,
      bottom: Math.max(FAB_BOTTOM_OFFSET_PX, window.innerHeight - rect.bottom + FAB_BOTTOM_OFFSET_PX),
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
