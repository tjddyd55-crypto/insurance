import type { NewsletterItem } from '../../types'

export type BoardWriterNewsListViewProps = {
  boardLabel: string
  boardScopeLabel: string
  items: NewsletterItem[]
  error: string
  loading: boolean
  emptyMessage: string
  listPathPrefix: string
  uploadPath: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  noSearchResults: boolean
}
