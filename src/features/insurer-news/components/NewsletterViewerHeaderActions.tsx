import { FormButton } from '../../../components/form'

type Props = {
  heroDownloadUrl?: string | null
  canEdit?: boolean
  onEdit?: () => void
  editLabel?: string
  canDelete?: boolean
  onDelete?: () => void
  deleteBusy?: boolean
  deleteLabel?: string
}

/**
 * 소식지 상세 모달 headerActions SSOT.
 * board-writer 상세 모달 버튼 배치·스타일을 기준으로 통일한다.
 */
export function NewsletterViewerHeaderActions({
  heroDownloadUrl,
  canEdit = false,
  onEdit,
  editLabel = '수정',
  canDelete = false,
  onDelete,
  deleteBusy = false,
  deleteLabel = '삭제',
}: Props) {
  const showEdit = canEdit && onEdit != null
  const showDelete = canDelete && onDelete != null

  if (!heroDownloadUrl && !showEdit && !showDelete) {
    return null
  }

  return (
    <>
      {heroDownloadUrl ? (
        <a
          href={heroDownloadUrl}
          download
          className="button filter-button download-btn"
          target="_blank"
          rel="noreferrer"
        >
          다운로드
        </a>
      ) : null}
      {showEdit ? (
        <FormButton htmlType="button" variant="primary" onClick={onEdit}>
          {editLabel}
        </FormButton>
      ) : null}
      {showDelete ? (
        <FormButton htmlType="button" variant="secondary" disabled={deleteBusy} onClick={onDelete}>
          {deleteBusy ? '삭제 중…' : deleteLabel}
        </FormButton>
      ) : null}
    </>
  )
}
