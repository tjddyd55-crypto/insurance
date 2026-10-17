import { useCallback, useState } from 'react'

type Props = {
  text: string
  label?: string
}

export function AdvisorPublicCopyButton({ text, label = '복사' }: Props) {
  const [done, setDone] = useState(false)

  const onCopy = useCallback(async () => {
    const value = text.trim()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      window.setTimeout(() => setDone(false), 1600)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      } catch {
        /* ignore */
      }
    }
  }, [text])

  return (
    <button
      type="button"
      className="pap-copy-btn"
      aria-label={label}
      title={done ? '복사되었습니다.' : label}
      onClick={() => void onCopy()}
    >
      {done ? (
        <span className="pap-copy-btn__ok" aria-live="polite">✓</span>
      ) : (
        <svg className="pap-copy-btn__icon" viewBox="0 0 24 24" aria-hidden width="18" height="18">
          <path
            fill="currentColor"
            d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z"
          />
        </svg>
      )}
    </button>
  )
}
