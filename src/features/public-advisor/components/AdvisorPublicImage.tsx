import { useState } from 'react'

type Props = {
  src: string | null | undefined
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}

export function AdvisorPublicImage({ src, alt, className, loading = 'lazy' }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  if (!showImage) {
    return <div className={className ? `${className} pap-img-fallback` : 'pap-img-fallback'} aria-hidden />
  }

  return (
    <img
      className={className}
      src={src!}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
