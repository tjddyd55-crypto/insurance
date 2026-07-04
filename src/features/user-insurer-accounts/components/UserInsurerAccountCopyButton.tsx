import { useCallback, useEffect, useRef, useState } from 'react'
import { FormButton } from '../../../components/form'
import { copyTextToClipboard } from '../../../lib/clipboard'

type UserInsurerAccountCopyButtonProps = {
  value: string
  disabled?: boolean
  label: string
}

export function UserInsurerAccountCopyButton({
  value,
  disabled = false,
  label,
}: UserInsurerAccountCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canCopy = value.trim().length > 0 && !disabled

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (!canCopy) {
      return
    }
    const ok = await copyTextToClipboard(value)
    if (!ok) {
      return
    }
    setCopied(true)
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, 1500)
  }, [canCopy, value])

  return (
    <FormButton
      htmlType="button"
      variant="secondary"
      size="sm"
      disabled={!canCopy}
      onClick={() => void handleCopy()}
      aria-label={`${label} 복사`}
    >
      {copied ? '복사됨' : '복사'}
    </FormButton>
  )
}
