import type { NewsletterItem } from '../../types'

export type BoardWriterNewsListViewProps = {
  pageTitle: string
  items: NewsletterItem[]
  error: string
  loading: boolean
  emptyMessage: string
  listPathPrefix: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  noSearchResults: boolean
}
