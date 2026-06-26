import { useCallback, useEffect, useRef, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { copyTextToClipboard } from '../../../lib/clipboard'

type UserInsurerAccountInputWithCopyProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  autoComplete?: string
}

export function UserInsurerAccountInputWithCopy({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete,
}: UserInsurerAccountInputWithCopyProps) {
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
    <div className="user-insurer-account-input-group">
      <FormInput
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="user-insurer-account-copy-button"
        disabled={!canCopy}
        onClick={() => void handleCopy()}
        aria-label={`${placeholder} 복사`}
      >
        {copied ? '복사됨' : '복사'}
      </FormButton>
    </div>
  )
}
