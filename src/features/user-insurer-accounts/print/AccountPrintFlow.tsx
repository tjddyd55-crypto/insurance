import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AccountPrintLayout, ACCOUNT_PRINT_CSS } from './AccountPrintLayout'
import type { AccountPrintData } from './accountPrintLayout'
import { fitAccountPrintSheet } from './fitAccountPrintSheet'

export function PrintPortal({ data, onDone }: { data: AccountPrintData; onDone: () => void }) {
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
        if (root.current) fitAccountPrintSheet(root.current)
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
  }, [onDone])
  return createPortal(
    <div id="account-a4-print-root" ref={root} aria-hidden="true">
      <style>{ACCOUNT_PRINT_CSS}</style>
      <AccountPrintLayout {...data} />
    </div>,
    document.body,
  )
}

