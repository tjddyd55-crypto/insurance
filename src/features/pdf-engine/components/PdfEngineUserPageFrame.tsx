import type { ReactNode } from 'react'

type PdfEngineUserPageFrameProps = {
  embedded?: boolean
  children: ReactNode
}

/** 사용자용 PDF 목록·이력 페이지 공통 본문 정렬 shell */
export function PdfEngineUserPageFrame({ embedded = false, children }: PdfEngineUserPageFrameProps) {
  return (
    <main
      className={`pdf-engine-page user-page${embedded ? ' pdf-engine-page--workspace-embedded' : ''}`}
    >
      <div className="pdf-engine-page__content">{children}</div>
    </main>
  )
}
