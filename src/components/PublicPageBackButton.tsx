import { useNavigate } from 'react-router-dom'

const BACK_LABEL = '\u2190 \uB4A4\uB85C\uAC00\uAE30'

type PublicPageBackButtonProps = {
  className?: string
  /** When there is no history entry to go back to */
  fallbackTo?: string
}

export function PublicPageBackButton({
  className,
  fallbackTo = '/',
}: PublicPageBackButtonProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={className}
      aria-label={BACK_LABEL}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(fallbackTo)
        }
      }}
    >
      {BACK_LABEL}
    </button>
  )
}
