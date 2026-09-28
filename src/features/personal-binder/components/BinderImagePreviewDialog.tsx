import { useState } from 'react'

import NewsDetailViewerModal from '../../../components/news-detail-viewer/NewsDetailViewerModal'
import NewsDetailZoomContent from '../../../components/news-detail-viewer/NewsDetailZoomContent'
import { clampNewsDetailViewerZoom } from '../../../components/news-detail-viewer/newsDetailViewerZoom'

export function BinderImagePreviewDialog({
  open,
  title,
  url,
  onClose,
}: {
  open: boolean
  title: string
  url: string | null
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)

  return (
    <NewsDetailViewerModal
      open={open}
      onClose={() => {
        setZoom(1)
        onClose()
      }}
      zoom={zoom}
      onZoomChange={(value) => setZoom(clampNewsDetailViewerZoom(value))}
      onZoomIn={() => setZoom((value) => clampNewsDetailViewerZoom(value + 0.25))}
      onZoomOut={() => setZoom((value) => Math.max(1, clampNewsDetailViewerZoom(value - 0.25)))}
      zoomControlVariant="labels"
      ariaLabel={`${title} 이미지 미리보기`}
      loading={!url}
      loadingMessage="이미지를 불러오는 중…"
      panelClassName="personal-binder-image-preview"
    >
      <NewsDetailZoomContent zoom={zoom} className="personal-binder-image-preview__content">
        {url ? <img src={url} alt={title} /> : null}
      </NewsDetailZoomContent>
    </NewsDetailViewerModal>
  )
}
