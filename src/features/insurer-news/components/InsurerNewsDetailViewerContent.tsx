import NewsDetailZoomContent from '../../../components/news-detail-viewer/NewsDetailZoomContent'
import type { NewsletterDetail, NewsletterItem } from '../types'
import { buildInsurerNewsGalleryUrls } from '../utils/buildInsurerNewsGalleryUrls'
import { getNewsletterLinkPreview } from '../utils/getNewsletterLinkPreview.js'
import { resolveInsurerNewsListCardImageUrl } from '../utils/resolveInsurerNewsImageUrl'
import { normalizeInsurerNewsText } from '../utils/insurerNewsText'
import { AutoLinkText } from './AutoLinkText'
import { LinkPreviewCard } from './LinkPreviewCard'
import { NewsletterAttachmentList } from './NewsletterAttachmentList'

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

  const bodyText = normalizeInsurerNewsText(detail?.bodyText) || normalizeInsurerNewsText(item?.summary)
  const linkPreview = getNewsletterLinkPreview(detail)

  return (
    <NewsDetailZoomContent zoom={zoom}>
      {bodyText ? (
        <AutoLinkText text={bodyText} className="news-text" enableAutoLinking enablePhoneLinks />
      ) : null}
      {linkPreview?.url ? (
        <div style={{ marginTop: 12 }}>
          <LinkPreviewCard preview={linkPreview} />
        </div>
      ) : null}
      {modalGalleryUrls.map((url) => (
        <img key={url} src={url} alt="" />
      ))}
      {detail?.attachments?.length ? (
        <NewsletterAttachmentList attachments={detail.attachments} />
      ) : null}
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
