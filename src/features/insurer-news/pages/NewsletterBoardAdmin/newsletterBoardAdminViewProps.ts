import type { NewsletterBoard } from '../../types'

export type NewsletterBoardCreateMode = 'global' | 'ga'

export type NewsletterBoardAdminViewProps = {
  role: string
  boards: NewsletterBoard[]
  globalBoards: NewsletterBoard[]
  gaBoards: NewsletterBoard[]
  label: string
  description: string
  createMode: NewsletterBoardCreateMode
  loading: boolean
  busy: boolean
  error: string
  onLabelChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCreateModeChange: (mode: NewsletterBoardCreateMode) => void
  onCreate: () => void
  onDelete: (board: NewsletterBoard) => void
}
