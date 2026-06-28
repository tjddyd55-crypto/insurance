import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchActivePopupNotice, dismissPopupNotice } from '../api/noticesApi'
import type { ActivePopupNotice } from '../types/adminNotice.types'

export function useAdminNoticePopup(token: string | null | undefined) {
  const authToken = token?.trim() ?? ''
  const [notice, setNotice] = useState<ActivePopupNotice | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!authToken) {
      setNotice(null)
      setOpen(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchActivePopupNotice(authToken)
        if (cancelled) {
          return
        }
        setNotice(data)
        setOpen(Boolean(data))
      } catch {
        if (!cancelled) {
          setNotice(null)
          setOpen(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authToken])

  const close = useCallback(
    async (options?: { suppressToday?: boolean }) => {
      setOpen(false)
      if (!authToken || !notice) {
        return
      }
      if (options?.suppressToday) {
        try {
          await dismissPopupNotice(authToken, notice.id, { suppressToday: true })
        } catch {
          // dismiss failure should not block closing
        }
      }
    },
    [authToken, notice],
  )

  return useMemo(
    () => ({
      notice,
      open,
      close,
    }),
    [close, notice, open],
  )
}
