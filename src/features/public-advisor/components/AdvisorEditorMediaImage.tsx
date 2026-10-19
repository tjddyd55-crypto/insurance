import { useState } from 'react'

type Props = {
  src: string | null | undefined
  alt: string
  className?: string
  fit?: 'cover' | 'contain'
}

export function AdvisorEditorMediaImage({ src, alt, className, fit = 'cover' }: Props) {
  const [failed, setFailed] = useState(false)
  const show = Boolean(src?.trim()) && !failed

  if (!show) {
    return (
      <div
        className={className ? `${className} pap-editor-media-placeholder` : 'pap-editor-media-placeholder'}
        aria-hidden
      />
    )
  }

  return (
    <img
      className={className}
      src={src!}
      alt={alt}
      style={fit === 'contain' ? { objectFit: 'contain' } : { objectFit: 'cover' }}
      onError={() => {
        if (import.meta.env.DEV) {
          console.warn('[AdvisorEditorMediaImage] failed to load', src)
        }
        setFailed(true)
      }}
    />
  )
}
