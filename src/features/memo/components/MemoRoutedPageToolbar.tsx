import { FormButton } from '../../../components/form'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

type Props = {
  pageTitle?: string
  showList: boolean
  onToggleList: () => void
}

/** /memo 정식 페이지 상단 — 플로팅 FAB 대신 인라인 액션 */
export function MemoRoutedPageToolbar({ pageTitle = '메모', showList, onToggleList }: Props) {
  const { addAndSelectNote, handleAutoArrange, token } = useMemoWorkspace()

  if (!token?.trim()) {
    return (
      <header className="memo-routed-page-toolbar">
        <h1 className="memo-routed-page-toolbar__title">{pageTitle}</h1>
      </header>
    )
  }

  return (
    <header className="memo-routed-page-toolbar">
      <h1 className="memo-routed-page-toolbar__title">{pageTitle}</h1>
      <div className="memo-routed-page-toolbar__actions">
        <FormButton htmlType="button" variant="secondary" onClick={() => void addAndSelectNote()}>
          메모 추가
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={() => handleAutoArrange()}>
          정리하기
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={onToggleList}>
          {showList ? '목록 접기' : '목록 열기'}
        </FormButton>
      </div>
    </header>
  )
}
