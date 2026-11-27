import { createPortal } from 'react-dom'

export function OverlayToast({ message, className }: { message: string; className: string }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <p className={className} role="status" aria-live="polite">{message}</p>,
    document.body,
  )
}
