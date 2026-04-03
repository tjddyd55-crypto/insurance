import type { NewsletterAttachment } from '../types'
import { NewsletterPdfPreview } from './NewsletterPdfPreview'

type Props = {
  attachments: NewsletterAttachment[]
}

export function NewsletterAttachmentList({ attachments }: Props) {
  const pdfs = attachments.filter((a) => a.kind === 'pdf').sort((a, b) => a.sortOrder - b.sortOrder)
  if (!pdfs.length) {
    return (
      <p className="insurer-news-muted" style={{ fontSize: 14 }}>
        첨부된 PDF가 없습니다.
      </p>
    )
  }

  return (
    <section aria-label="PDF 첨부">
      <h2 className="insurer-news-hub__section-title">PDF 첨부</h2>
      {pdfs.map((p) => (
        <NewsletterPdfPreview key={p.id} fileName={p.fileName} href={p.url} />
      ))}
    </section>
  )
}
