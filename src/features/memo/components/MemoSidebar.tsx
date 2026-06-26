import { FormButton } from '../../../components/form'
import type { Note } from '../types/memo.types'


type Props = {
  notes: Note[]
  hiddenNotes: Record<string, boolean>
  minimizedNotes?: Record<string, boolean>
  isOpen: boolean
  onToggle: () => void
  onSelectNote: (id: string) => void
  onAutoArrange: () => void
  showToggle?: boolean
  /**
   * 헤더(제목 "메모 목록" + 정리하기 + 토글) 렌더 여부.
   *
   * 기본값은 `false`(헤더 표시) 이다. 모바일 레이아웃(`MemoPanelBody` 의
   * `memo-mobile-list` 영역) 에서는 헤더의 "메모 목록" 텍스트가 자리만 차지하고,
   * "정리하기" 는 FAB 영역으로 옮겨졌기 때문에 `hideHeader` 를 `true` 로 넘겨
   * 리스트에 사용 가능한 세로 공간을 최대로 확보한다.
   *
   * PC 우측 패널 / 기타 호출처는 기본값을 그대로 사용한다 (회귀 방지).
   */
  hideHeader?: boolean
  /** 현재 선택(활성) 메모 id — 라우트 페이지 목록 강조 */
  selectedNoteId?: string | null
  /** 정식 `/memo` 화면처럼 선택된 한 장만 캔버스에 표시하는 목록 모드 */
  singleCanvasMode?: boolean
}
export default function MemoSidebar({
  notes,
  hiddenNotes,
  minimizedNotes = {},
  isOpen,
  onToggle,
  onSelectNote,
  onAutoArrange,
  showToggle = true,
  hideHeader = false,
  selectedNoteId = null,
  singleCanvasMode = false,
}: Props) {
  return (
    <div className="memo-sidebar__inner">
      {!hideHeader ? (
        <div className="memo-sidebar__header">
          <span className="memo-sidebar__title">메모 목록</span>
          <div className="memo-sidebar__header-actions">
            {isOpen ? (
              <FormButton htmlType="button" className="memo-sidebar__arrange" onClick={onAutoArrange}>
                정리하기
              </FormButton>
            ) : null}
            {showToggle ? (
              <FormButton htmlType="button" className="memo-sidebar__toggle" onClick={onToggle}>
                {isOpen ? '\u25c0' : '\u25b6'}
              </FormButton>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="memo-sidebar__list" role="listbox" aria-label="메모 목록">
        {notes.map((note) => {
          const preview = note.content?.trim().slice(0, 20) || '내용 없음'
          const isActive = selectedNoteId === note.id
          const isExpandedOnCanvas = singleCanvasMode
            ? isActive
            : !hiddenNotes[note.id] && !minimizedNotes[note.id]
          return (
            <div
              key={note.id}
              role="option"
              aria-selected={isActive}
              className={[
                'memo-list-item',
                isExpandedOnCanvas ? 'memo-list-item--expanded' : '',
                isActive ? 'memo-list-item--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(e) => {
                e.stopPropagation()
                onSelectNote(note.id)
              }}
            >
              {preview}
            </div>
          )
        })}
      </div>
    </div>
  )
}
