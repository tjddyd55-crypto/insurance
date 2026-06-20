import NewsDetailZoomContent from '../../../components/news-detail-viewer/NewsDetailZoomContent'
import type { NewsletterDetail, NewsletterItem } from '../types'
import { buildInsurerNewsGalleryUrls } from '../utils/buildInsurerNewsGalleryUrls'
import { resolveInsurerNewsListCardImageUrl } from '../utils/resolveInsurerNewsImageUrl'

type InsurerNewsDetailViewerContentProps = {
  zoom: number
  detail: NewsletterDetail | null
  item: NewsletterItem | null
}

/**
 * 원수사/손해사정사/동적 게시판 PC 뷰어 모달 본문 — InsurerManagerNewsListPCView 와 동일 마크업.
 */
export function InsurerNewsDetailViewerContent({
  zoom,
  detail,
  item,
}: InsurerNewsDetailViewerContentProps) {
  const modalGalleryUrls = detail
    ? buildInsurerNewsGalleryUrls({
        heroImageUrl: detail.heroImageUrl,
        heroImageObjectKey: detail.heroImageObjectKey,
        attachments: detail.attachments,
      })
    : item
      ? [resolveInsurerNewsListCardImageUrl(item)].filter(Boolean)
      : []

  const bodyText = detail?.bodyText?.trim() || item?.summary?.trim()

  return (
    <NewsDetailZoomContent zoom={zoom}>
      {bodyText ? <div className="news-text">{bodyText}</div> : null}
      {modalGalleryUrls.map((url) => (
        <img key={url} src={url} alt="" />
      ))}
    </NewsDetailZoomContent>
  )
}

export function buildInsurerNewsDetailHeroDownloadUrl(
  detail: NewsletterDetail | null,
  item: NewsletterItem | null,
): string {
  if (detail) {
    return (
      buildInsurerNewsGalleryUrls({
        heroImageUrl: detail.heroImageUrl,
        heroImageObjectKey: detail.heroImageObjectKey,
        attachments: detail.attachments,
      })[0] ?? ''
    )
  }
  if (item) {
    return resolveInsurerNewsListCardImageUrl(item)
  }
  return ''
}
