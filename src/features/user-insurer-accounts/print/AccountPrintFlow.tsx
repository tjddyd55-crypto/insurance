import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AccountPrintLayout } from './AccountPrintLayout'
import { getAccountPrintCss } from './accountPrintStyles'
import type { AccountPrintData, PrintOrientation } from './accountPrintLayout'
import { fitAccountPrintSheet } from './fitAccountPrintSheet'

export function PrintPortal({ data, orientation = data.orientation ?? 'landscape', onDone }: { data: AccountPrintData; orientation?: PrintOrientation; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    let frame = 0
    const finish = () => onDone()
    window.addEventListener('afterprint', finish)
    // Font loading and two frames let the committed table finish layout first.
    void document.fonts.ready.then(() => {
      if (cancelled) return
      frame = requestAnimationFrame(() => {
        if (root.current) fitAccountPrintSheet(root.current, orientation)
        frame = requestAnimationFrame(() => {
          if (cancelled) return
          try { window.print() } catch { onDone() }
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', finish)
    }
  }, [onDone, orientation])
  return createPortal(
    <div id="account-a4-print-root" ref={root} aria-hidden="true">
      <style>{getAccountPrintCss(orientation)}</style>
      <AccountPrintLayout {...data} orientation={orientation} />
    </div>,
    document.body,
  )
}

