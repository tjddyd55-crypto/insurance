import { useEffect } from 'react'

export const BINDER_SOURCES_CHANGED = 'personal-binder-sources-changed'

export function useBinderSourceRefresh(refresh: () => Promise<unknown>) {
  useEffect(() => {
    const onRefresh = () => { void refresh() }
    window.addEventListener(BINDER_SOURCES_CHANGED, onRefresh)
    window.addEventListener('focus', onRefresh)
    return () => {
      window.removeEventListener(BINDER_SOURCES_CHANGED, onRefresh)
      window.removeEventListener('focus', onRefresh)
    }
  }, [refresh])
}
