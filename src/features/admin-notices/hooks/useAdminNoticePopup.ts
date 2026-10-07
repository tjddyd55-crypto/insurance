import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchActivePopupNotice, dismissPopupNotice } from '../api/noticesApi'
import type { ActivePopupNotice } from '../types/adminNotice.types'

export function useAdminNoticePopup(token: string | null | undefined) {
  const authToken = token?.trim() ?? ''
  const [notice, setNotice] = useState<ActivePopupNotice | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!authToken) {
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
      } catch (error) {
        console.warn('[admin-notice-popup] failed to load active popup', error)
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

  const visibleNotice = authToken ? notice : null
  const visibleOpen = authToken ? open : false

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
      notice: visibleNotice,
      open: visibleOpen,
      close,
    }),
    [close, visibleNotice, visibleOpen],
  )
}
