import type { NewsletterBoard } from '../../types'

export type NewsletterBoardCreateMode = 'global' | 'ga'

export type NewsletterBoardAdminViewProps = {
  role: string
  token: string
  boards: NewsletterBoard[]
  globalBoards: NewsletterBoard[]
  gaBoards: NewsletterBoard[]
  label: string
  description: string
  createMode: NewsletterBoardCreateMode
  loading: boolean
  busy: boolean
  error: string
  notice: string
  selectedBoard: NewsletterBoard | null
  onLabelChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCreateModeChange: (mode: NewsletterBoardCreateMode) => void
  onCreate: () => void
  onDelete: (board: NewsletterBoard) => void
  onEdit: (board: NewsletterBoard) => void
  onSelectBoard: (board: NewsletterBoard | null) => void
  onWriterBusyChange: (busy: boolean) => void
}
