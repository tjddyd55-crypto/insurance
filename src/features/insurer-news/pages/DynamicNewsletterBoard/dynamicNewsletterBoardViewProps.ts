import type { NewsletterBoard, NewsletterItem } from '../../types'

export type DynamicNewsletterBoardViewProps = {
  board: NewsletterBoard | null
  items: NewsletterItem[]
  error: string
  loading: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  openPathPrefix: string
  noSearchResults: boolean
}
