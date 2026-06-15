import type { NewsletterBoard } from '../../types'

export type NewsletterBoardAdminViewProps = {
  role: string
  boards: NewsletterBoard[]
  label: string
  isPublic: boolean
  loading: boolean
  busy: boolean
  error: string
  onLabelChange: (value: string) => void
  onPublicChange: (value: boolean) => void
  onCreate: () => void
  onDelete: (board: NewsletterBoard) => void
}
