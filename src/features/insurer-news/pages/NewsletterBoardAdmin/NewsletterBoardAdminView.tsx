import { Link } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoard } from '../../types'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import { NewsletterBoardWriterPanel } from './NewsletterBoardWriterPanel'
import './newsletter-board-admin.css'

function boardScopeLabel(board: NewsletterBoard) {
  if (board.boardScope === 'global' || board.contentScope === 'global') return '공용 소식지'
  return 'GA전용 소식지'
}

export function NewsletterBoardAdminView({
  role,
  token,
  globalBoards,
  gaBoards,
  label,
  description,
  createMode,
  loading,
  busy,
  error,
  selectedBoard,
  onLabelChange,
  onDescriptionChange,
  onCreate,
  onDelete,
  onSelectBoard,
  onWriterBusyChange,
}: NewsletterBoardAdminViewProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const isGaAdmin = role === 'GA_ADMIN'

  return (
    <>
      <section className="newsletter-board-admin-page__intro">
        <h1>{isSuperAdmin ? '소식지 관리' : 'GA전용 소식지 관리'}</h1>
        <p>
          {isSuperAdmin
            ? '시스템 소식지(원수사·손해사정사)는 기존 메뉴를 유지합니다. 공용 소식지는 모든 GA에 노출됩니다.'
            : '현재 GA에만 메뉴가 표시되는 소식지를 관리합니다.'}
        </p>
        {isSuperAdmin ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                소식지 작성자 로그인
              </FormButton>
            </Link>
            <p className="newsletter-board-admin-page__help" style={{ margin: '8px 0 0' }}>
              공용 소식지별 작성자 계정은 아래 목록에서 소식지를 선택해 관리합니다.
            </p>
          </div>
        ) : (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                GA전용 작성자 로그인
              </FormButton>
            </Link>
          </div>
        )}
      </section>

      {isSuperAdmin ? (
        <section className="newsletter-board-admin-page__panel">
          <h2 className="newsletter-board-admin-page__panel-title">시스템 소식지</h2>
          <ul className="newsletter-board-admin-page__policy-list">
            <li>원수사 소식지 — `/portal/newsletters` (기존 유지)</li>
            <li>손해사정사 소식지 — `/portal/adjuster-news` (기존 유지)</li>
          </ul>
        </section>
      ) : null}

      <section className="newsletter-board-admin-page__panel">
        <h2 className="newsletter-board-admin-page__panel-title">
          {isSuperAdmin ? '공용 소식지 추가' : 'GA전용 소식지 추가'}
        </h2>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span className="form-label">소식지명</span>
            <FormInput
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder={isSuperAdmin ? '예: 노무사 소식지' : '예: 내부 공지'}
              maxLength={40}
            />
          </label>
          <label className="form-field">
            <span className="form-label">설명 (선택)</span>
            <FormInput value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </label>
        </div>
        <p className="newsletter-board-admin-page__help">
          {isSuperAdmin && createMode === 'global'
            ? '공용 소식지: 모든 GA에 메뉴가 표시되고, 모든 GA가 같은 글을 봅니다. 작성자는 전체 관리자가 소식지별로 별도 부여합니다.'
            : 'GA전용 소식지: 현재 GA에만 메뉴가 표시되고, 현재 GA 안에서만 글을 봅니다. 작성자는 GA 관리자가 소식지별로 별도 부여합니다.'}
        </p>
        <div className="newsletter-board-admin-page__toolbar">
          <FormButton htmlType="button" variant="primary" disabled={busy || !label.trim()} onClick={onCreate}>
            {busy ? '추가 중...' : isSuperAdmin && createMode === 'global' ? '공용 소식지 추가' : 'GA전용 소식지 추가'}
          </FormButton>
        </div>
        {error ? (
          <p className="status status--error" style={{ marginTop: 10 }}>
            {error}
          </p>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <BoardTable
          title="공용 소식지 목록"
          boards={globalBoards}
          loading={loading}
          busy={busy}
          canDelete
          canManageWriters
          selectedBoardId={selectedBoard?.id ?? null}
          onDelete={onDelete}
          onSelectBoard={onSelectBoard}
          writerPanel={
            selectedBoard &&
            token.trim() &&
            globalBoards.some((board) => board.id === selectedBoard.id) ? (
              <NewsletterBoardWriterPanel
                board={selectedBoard}
                token={token}
                role={role}
                busy={busy}
                onBusyChange={onWriterBusyChange}
              />
            ) : null
          }
        />
      ) : null}

      {isGaAdmin ? (
        <BoardTable
          title="GA전용 소식지 목록"
          boards={gaBoards}
          loading={loading}
          busy={busy}
          canDelete
          canManageWriters
          selectedBoardId={selectedBoard?.id ?? null}
          onDelete={onDelete}
          onSelectBoard={onSelectBoard}
          writerPanel={
            selectedBoard &&
            token.trim() &&
            gaBoards.some((board) => board.id === selectedBoard.id) ? (
              <NewsletterBoardWriterPanel
                board={selectedBoard}
                token={token}
                role={role}
                busy={busy}
                onBusyChange={onWriterBusyChange}
              />
            ) : null
          }
        />
      ) : null}
    </>
  )
}

function BoardTable({
  title,
  boards,
  loading,
  busy,
  canDelete,
  canManageWriters = false,
  selectedBoardId,
  onDelete,
  onSelectBoard,
  writerPanel = null,
}: {
  title: string
  boards: NewsletterBoard[]
  loading: boolean
  busy: boolean
  canDelete: boolean
  canManageWriters?: boolean
  selectedBoardId: string | null
  onDelete: (board: NewsletterBoard) => void
  onSelectBoard: (board: NewsletterBoard | null) => void
  writerPanel?: React.ReactNode
}) {
  return (
    <section className="newsletter-board-admin-page__panel">
      <h2 className="newsletter-board-admin-page__panel-title">{title}</h2>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {!loading && boards.length > 0 ? (
        <div className="newsletter-board-admin-page__table-wrap">
          <table className="newsletter-board-admin-page__table">
            <thead>
              <tr>
                <th>소식지명</th>
                <th>유형</th>
                <th>GA</th>
                <th>경로</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => {
                const isSelected = selectedBoardId === board.id
                return (
                  <tr
                    key={board.id}
                    className={
                      isSelected
                        ? 'newsletter-board-admin-page__row newsletter-board-admin-page__row--selected newsletter-board-admin-page__row--clickable'
                        : canManageWriters
                          ? 'newsletter-board-admin-page__row newsletter-board-admin-page__row--clickable'
                          : 'newsletter-board-admin-page__row'
                    }
                    onClick={() => {
                      if (!canManageWriters) {
                        return
                      }
                      onSelectBoard(isSelected ? null : board)
                    }}
                  >
                    <td>{board.label}</td>
                    <td>
                      <span className="newsletter-board-admin-page__scope-badge">{boardScopeLabel(board)}</span>
                    </td>
                    <td>{board.gaName ?? board.gaCode ?? '—'}</td>
                    <td className="newsletter-board-admin-page__path">{`/portal/boards/${board.slug}`}</td>
                    <td>
                      <div className="newsletter-board-admin-page__row-actions">
                        {canManageWriters ? (
                          <FormButton
                            htmlType="button"
                            variant={isSelected ? 'primary' : 'secondary'}
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onSelectBoard(isSelected ? null : board)
                            }}
                          >
                            작성자 관리
                          </FormButton>
                        ) : null}
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="newsletter-board-admin-page__delete-btn"
                          disabled={busy || !canDelete}
                          onClick={(event) => {
                            event.stopPropagation()
                            onDelete(board)
                          }}
                        >
                          삭제
                        </FormButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {writerPanel}
    </section>
  )
}
