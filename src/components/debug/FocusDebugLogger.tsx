import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FOCUS_DEBUG_EVENT,
  isFocusDebugEnabled,
  type FocusDebugDetail,
} from '../../lib/focusDebug'

const FOCUS_DEBUG_ENABLED = isFocusDebugEnabled()

type FocusDebugEvent = CustomEvent<{
  type: string
  detail?: FocusDebugDetail
}>

const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '.customer-ui-modal-backdrop',
  '.mobile-modal-overlay',
  '.mobile-workspace-drawer--overlay',
  '.news-detail-viewer-backdrop',
  '.desktop-update-dialog',
  '.electron-force-update-gate',
  '.web-app-update-banner__overlay',
  '.consent-signature-backdrop',
  '.customer-app-news-fs',
].join(',')

function describeElement(value: EventTarget | Element | null): string {
  if (!(value instanceof Element)) {
    return String(value ?? 'null')
  }
  const tag = value.tagName.toLowerCase()
  const id = value.id ? `#${value.id}` : ''
  const classes = Array.from(value.classList)
    .slice(0, 3)
    .map((className) => `.${className}`)
    .join('')
  return `${tag}${id}${classes}`
}

function visibleOverlayElements(): Element[] {
  const seen = new Set<Element>()
  return Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).filter((element) => {
    if (seen.has(element)) {
      return false
    }
    seen.add(element)
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

function readSnapshot(pointer?: { x: number; y: number }): FocusDebugDetail {
  const root = document.getElementById('root')
  const overlayDetails = visibleOverlayElements().map((element) => {
    const style = window.getComputedStyle(element)
    return {
      element: describeElement(element),
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      zIndex: style.zIndex,
    }
  })

  return {
    activeElement: describeElement(document.activeElement),
    documentHasFocus: document.hasFocus(),
    bodyClassName: document.body.className,
    bodyPointerEvents: document.body.style.pointerEvents,
    bodyOverflow: document.body.style.overflow,
    rootInert: root?.hasAttribute('inert') ?? false,
    rootAriaHidden: root?.getAttribute('aria-hidden') ?? null,
    openOverlays: overlayDetails,
    loadingOverlays: document.querySelectorAll('[aria-busy="true"], [class*="loading-overlay"]').length,
    elementsFromPoint: pointer
      ? document.elementsFromPoint(pointer.x, pointer.y).slice(0, 8).map(describeElement)
      : [],
  }
}

/**
 * Opt-in browser instrumentation for a focus-loss incident.
 * It only observes events and DOM state; it never moves focus or changes interaction state.
 */
export function FocusDebugLogger() {
  const location = useLocation()
  const lastOverlaySignatureRef = useRef('')

  useEffect(() => {
    if (!FOCUS_DEBUG_ENABLED) {
      return
    }

    const log = (type: string, target?: EventTarget | null, pointer?: { x: number; y: number }, detail?: FocusDebugDetail) => {
      console.info('[focus-debug]', type, {
        target: describeElement(target ?? null),
        ...readSnapshot(pointer),
        ...detail,
      })
    }
    const onDomEvent = (event: Event) => {
      const pointer = event instanceof PointerEvent ? { x: event.clientX, y: event.clientY } : undefined
      log(event.type, event.target, pointer)
    }
    const onDebugEvent = (event: Event) => {
      const detail = (event as FocusDebugEvent).detail
      log(detail?.type ?? 'internal', null, undefined, detail?.detail)
    }
    const auditOverlays = () => {
      const snapshot = readSnapshot()
      const signature = JSON.stringify({
        bodyOverflow: snapshot.bodyOverflow,
        rootInert: snapshot.rootInert,
        rootAriaHidden: snapshot.rootAriaHidden,
        overlays: snapshot.openOverlays,
      })
      if (signature !== lastOverlaySignatureRef.current) {
        lastOverlaySignatureRef.current = signature
        log('overlay-state')
      }
    }
    let auditFrame = 0
    const scheduleOverlayAudit = () => {
      if (auditFrame) {
        return
      }
      auditFrame = window.requestAnimationFrame(() => {
        auditFrame = 0
        auditOverlays()
      })
    }

    const eventTypes = ['focusin', 'focusout', 'pointerdown', 'click', 'keydown', 'submit'] as const
    eventTypes.forEach((eventType) => document.addEventListener(eventType, onDomEvent, true))
    window.addEventListener(FOCUS_DEBUG_EVENT, onDebugEvent as EventListener)
    const observer = new MutationObserver(scheduleOverlayAudit)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-modal', 'aria-busy', 'role'],
    })
    log('logger-mounted')
    auditOverlays()

    return () => {
      eventTypes.forEach((eventType) => document.removeEventListener(eventType, onDomEvent, true))
      window.removeEventListener(FOCUS_DEBUG_EVENT, onDebugEvent as EventListener)
      observer.disconnect()
      if (auditFrame) {
        window.cancelAnimationFrame(auditFrame)
      }
    }
  }, [])

  useEffect(() => {
    if (FOCUS_DEBUG_ENABLED) {
      console.info('[focus-debug] route-change', {
        route: `${location.pathname}${location.search}`,
        ...readSnapshot(),
      })
    }
  }, [location.pathname, location.search])

  return null
}
