import type { CSSProperties, ReactNode } from 'react'

type NewsDetailZoomContentProps = {
  zoom: number
  children: ReactNode
  className?: string
}

/**
 * 확대 시 layout width를 키워 scroll container에서 가로 스크롤이 생기도록 한다.
 * transform scale 단독 사용 시 스크롤 영역이 늘지 않는 문제를 피한다.
 */
export default function NewsDetailZoomContent({ zoom, children, className }: NewsDetailZoomContentProps) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const scopeStyle: CSSProperties = {
    ['--news-zoom' as string]: String(safeZoom),
    width: safeZoom > 1 ? `${safeZoom * 100}%` : '100%',
    minWidth: '100%',
  }

  return (
    <div className={['news-detail-zoom-scope', className].filter(Boolean).join(' ')} style={scopeStyle}>
      {children}
    </div>
  )
}
