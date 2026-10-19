import { useState } from 'react'

type Props = {
  src: string | null | undefined
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  /** 로드 전 레이아웃 예약. Hero 슬롯 비율과 같게 둔다. */
  width?: number
  height?: number
}

export function AdvisorPublicImage({ src, alt, className, loading = 'lazy', width, height }: Props) {
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
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
