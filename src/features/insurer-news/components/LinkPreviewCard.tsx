import type { NewsletterLinkPreview } from '../types'

type Props = {
  preview: NewsletterLinkPreview
  className?: string
}

export function LinkPreviewCard({ preview, className }: Props) {
  const href = String(preview.url ?? '').trim()
  if (!href) {
    return null
  }
  const title = String(preview.title ?? '').trim()
  const description = String(preview.description ?? '').trim()
  const imageUrl = String(preview.imageUrl ?? '').trim()
  const site =
    String(preview.siteName ?? '').trim() ||
    String(preview.domain ?? '').trim() ||
    (() => {
      try {
        return new URL(href).hostname.replace(/^www\./, '')
      } catch {
        return ''
      }
    })()

  return (
    <a
      className={`insurer-news-link-preview${className ? ` ${className}` : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {imageUrl ? (
        <div className="insurer-news-link-preview__media">
          <img src={imageUrl} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="insurer-news-link-preview__body">
        {title ? <strong className="insurer-news-link-preview__title">{title}</strong> : null}
        {description ? <p className="insurer-news-link-preview__description">{description}</p> : null}
        <span className="insurer-news-link-preview__domain">
          {site || href}
          <span aria-hidden="true"> ↗</span>
        </span>
      </div>
    </a>
  )
}
