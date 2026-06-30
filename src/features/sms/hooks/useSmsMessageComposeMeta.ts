import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateSmsMessageMeta,
  detectTransportTransition,
  type SmsMessageMeta,
  type SmsMessageMetaInput,
  type SmsTransportType,
} from '../utils/smsMessageMeta'

const TRANSITION_DISMISS_MS = 3000

export function useSmsMessageComposeMeta(input: SmsMessageMetaInput): {
  meta: SmsMessageMeta
  transitionNotice: string | null
  dismissTransitionNotice: () => void
} {
  const hasAttachment = Boolean(input.attachments?.some(Boolean))
  const substitutionKey = JSON.stringify(
    input.previewSubstitution ?? input.sampleVariables ?? { mode: 'preserve' },
  )

  const meta = useMemo(
    () => calculateSmsMessageMeta(input),
    [input.body, input.isAdvertisement, input.adCompanyName, input.optOutNumber, hasAttachment, substitutionKey],
  )

  const prevTypeRef = useRef<SmsTransportType>(meta.messageType)
  const [transitionNotice, setTransitionNotice] = useState<string | null>(null)

  useEffect(() => {
    const previous = prevTypeRef.current
    const next = meta.messageType
    if (previous !== next) {
      setTransitionNotice(detectTransportTransition(previous, next, hasAttachment))
      prevTypeRef.current = next
    }
  }, [meta.messageType, hasAttachment])

  useEffect(() => {
    if (!transitionNotice) {
      return undefined
    }
    const timer = window.setTimeout(() => setTransitionNotice(null), TRANSITION_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [transitionNotice])

  return {
    meta,
    transitionNotice,
    dismissTransitionNotice: () => setTransitionNotice(null),
  }
}
