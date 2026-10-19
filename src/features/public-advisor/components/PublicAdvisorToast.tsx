import { useSyncExternalStore } from 'react'
import { getPublicAdvisorToast, subscribePublicAdvisorToast } from '../toast/publicAdvisorToast'

export function PublicAdvisorToast() {
  const message = useSyncExternalStore(subscribePublicAdvisorToast, getPublicAdvisorToast, () => '')
  if (!message) return null
  return (
    <div className="pap-toast-dock">
      <p className="pap-toast" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
