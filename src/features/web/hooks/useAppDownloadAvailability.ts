import { useEffect, useState } from 'react'
import { APP_DOWNLOAD_ENDPOINTS } from '../constants/downloadLinks'

type DownloadAvailability = {
  desktop: boolean
  mobile: boolean
  loading: boolean
}

const INITIAL: DownloadAvailability = {
  desktop: false,
  mobile: false,
  loading: true,
}

export function useAppDownloadAvailability(): DownloadAvailability {
  const [state, setState] = useState<DownloadAvailability>(INITIAL)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(APP_DOWNLOAD_ENDPOINTS.status, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          if (!cancelled) {
            setState({ desktop: false, mobile: false, loading: false })
          }
          return
        }
        const payload = (await response.json()) as { desktop?: boolean; mobile?: boolean }
        if (!cancelled) {
          setState({
            desktop: payload.desktop === true,
            mobile: payload.mobile === true,
            loading: false,
          })
        }
      } catch {
        if (!cancelled) {
          setState({ desktop: false, mobile: false, loading: false })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
