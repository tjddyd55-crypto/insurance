import { Link } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import { canUseNewsletterBoardAdminRoutes } from '../../../auth/roleGuards'
import type { NewsletterBoard } from '../../types'
import { buildNewsletterBoardUploadPath } from '../../utils/newsletterBoardMenuLinks'
import { resolveNewsletterBoardAdminActions } from '../../utils/newsletterBoardAdminActions'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import { NewsletterBoardWriterPanel } from './NewsletterBoardWriterPanel'
import './newsletter-board-admin.css'

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
  notice,
  selectedBoard,
  onLabelChange,
  onDescriptionChange,
  onCreate,
  onDelete,
  onDisable,
  onEnable,
  onEdit,
  onSelectBoard,
  onWriterBusyChange,
}: NewsletterBoardAdminViewProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const canManageGaBoards = role === 'GA_ADMIN' || role === 'GA_STAFF'
  const canManageWriters = canUseNewsletterBoardAdminRoutes(role)

  return (
    <>
      <section className="newsletter-board-admin-page__intro">
        <h1>{isSuperAdmin ? '소식지 관리' : 'GA 게시판 관리'}</h1>
        <p>
          {isSuperAdmin
            ? '원수사 소식지는 기존 고정 메뉴를 유지합니다. 공용 게시판과 GA 게시판(손해사정사 기본 포함)은 같은 관리·작성자 화면을 사용합니다.'
            : '일반 GA 게시판과 손해사정사 기본 게시판을 같은 방식으로 관리합니다. 작성자 계정으로 글을 등록합니다.'}
        </p>
        {isSuperAdmin ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                소식지 작성자 로그인
              </FormButton>
            </Link>
          </div>
        ) : canManageGaBoards ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                게시판 작성자 로그인
              </FormButton>
            </Link>
            <p className="newsletter-board-admin-page__help" style={{ margin: '8px 0 0' }}>
              글 업로드는 작성자 전용 계정으로 로그인한 뒤 진행합니다. 손해사정사 기본 게시판도 동일합니다.
            </p>
          </div>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <section className="newsletter-board-admin-page__panel">
          <h2 className="newsletter-board-admin-page__panel-title">시스템 소식지</h2>
          <ul className="newsletter-board-admin-page__policy-list">
            <li>원수사 소식지 — `/portal/newsletters` (고정 유지, 이 목록에서 관리하지 않음)</li>
            <li>손해사정사 소식지 — GA 기본 게시판으로 관리 (route `/portal/adjuster-news` 유지)</li>
          </ul>
        </section>
      ) : null}

      <section className="newsletter-board-admin-page__panel">
        <h2 className="newsletter-board-admin-page__panel-title">
          {isSuperAdmin ? '공용 소식지 추가' : 'GA 게시판 추가'}
        </h2>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span className="form-label">소식지명</span>
            <FormInput
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder={isSuperAdmin ? '예: 노무사 소식지' : '예: 교육자료'}
              maxLength={40}
            />
          </label>
          <label className="form-field">
            <span className="form-label">설명 (선택)</span>
            <FormInput value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </label>
        </div>
        <div className="newsletter-board-admin-page__toolbar">
          <FormButton htmlType="button" variant="primary" disabled={busy || !label.trim()} onClick={onCreate}>
            {busy ? '추가 중...' : isSuperAdmin && createMode === 'global' ? '공용 소식지 추가' : 'GA 게시판 추가'}
          </FormButton>
        </div>
        {error ? (
          <p className="status status--error" style={{ marginTop: 10 }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="status status--success" style={{ marginTop: 10 }} role="status">
            {notice}
          </p>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <BoardTable
          title="공용 소식지 목록"
          role={role}
          boards={globalBoards}
          loading={loading}
          busy={busy}
          canManageWriters
          selectedBoardId={selectedBoard?.id ?? null}
          onDelete={onDelete}
          onDisable={onDisable}
          onEnable={onEnable}
          onEdit={onEdit}
          onSelectBoard={onSelectBoard}
          writerPanel={
            selectedBoard &&
            token.trim() &&
            globalBoards.some((board) => board.id === selectedBoard.id) ? (
              <NewsletterBoardWriterPanel
                key={selectedBoard.id}
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

      {canManageGaBoards ? (
        <BoardTable
          title="GA 게시판 목록"
          role={role}
          boards={gaBoards}
          loading={loading}
          busy={busy}
          canManageWriters={canManageWriters}
          selectedBoardId={selectedBoard?.id ?? null}
          onDelete={onDelete}
          onDisable={onDisable}
          onEnable={onEnable}
          onEdit={onEdit}
          onSelectBoard={onSelectBoard}
          writerPanel={
            selectedBoard &&
            token.trim() &&
            gaBoards.some((board) => board.id === selectedBoard.id) ? (
              <NewsletterBoardWriterPanel
                key={selectedBoard.id}
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
  role,
  boards,
  loading,
  busy,
  canManageWriters = false,
  selectedBoardId,
  onDelete,
  onDisable,
  onEnable,
  onEdit,
  onSelectBoard,
  writerPanel = null,
}: {
  title: string
  role: string
  boards: NewsletterBoard[]
  loading: boolean
  busy: boolean
  canManageWriters?: boolean
  selectedBoardId: string | null
  onDelete: (board: NewsletterBoard) => void
  onDisable: (board: NewsletterBoard) => void
  onEnable: (board: NewsletterBoard) => void
  onEdit: (board: NewsletterBoard) => void
  onSelectBoard: (board: NewsletterBoard | null) => void
  writerPanel?: React.ReactNode
}) {
  return (
    <section className="newsletter-board-admin-page__panel">
      <h2 className="newsletter-board-admin-page__panel-title">{title}</h2>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {!loading && boards.length === 0 ? (
        <div className="insurer-news-empty">현재 사용 중인 GA 소식지가 없습니다.</div>
      ) : null}
      {!loading && boards.length > 0 ? (
        <div className="newsletter-board-admin-page__table-wrap">
          <table className="newsletter-board-admin-page__table">
            <thead>
              <tr>
                <th>이름</th>
                <th>구분</th>
                <th>상태</th>
                <th>경로</th>
                <th>바로가기</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => {
                const actions = resolveNewsletterBoardAdminActions(board, role)
                const isActive = board.isActive !== false
                const isSelected = selectedBoardId === board.id
                const allowWriterSelect = canManageWriters && actions.canManageAuthors
                return (
                  <tr
                    key={board.id}
                    className={
                      isSelected
                        ? 'newsletter-board-admin-page__row newsletter-board-admin-page__row--selected newsletter-board-admin-page__row--clickable'
                        : allowWriterSelect
                          ? 'newsletter-board-admin-page__row newsletter-board-admin-page__row--clickable'
                          : 'newsletter-board-admin-page__row'
                    }
                    onClick={() => {
                      if (!allowWriterSelect) {
                        return
                      }
                      onSelectBoard(isSelected ? null : board)
                    }}
                  >
                    <td>{board.label}</td>
                    <td>
                      <span
                        className={
                          actions.isSystemDefault
                            ? 'newsletter-board-admin-page__scope-badge newsletter-board-admin-page__scope-badge--system'
                            : 'newsletter-board-admin-page__scope-badge'
                        }
                      >
                        {actions.kindLabel}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          isActive
                            ? 'newsletter-board-admin-page__status-badge newsletter-board-admin-page__status-badge--active'
                            : 'newsletter-board-admin-page__status-badge newsletter-board-admin-page__status-badge--inactive'
                        }
                      >
                        {isActive ? '사용 중' : '사용 중지'}
                      </span>
                    </td>
                    <td className="newsletter-board-admin-page__path">{actions.portalPath}</td>
                    <td>
                      {isActive ? (
                        <div className="newsletter-board-admin-page__row-actions newsletter-board-admin-page__row-actions--links">
                          <Link
                            to={actions.portalPath}
                            className="button button--small button--secondary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            조회
                          </Link>
                          {actions.showUploadLink ? (
                            <Link
                              to={buildNewsletterBoardUploadPath(board.slug)}
                              className="button button--small button--secondary"
                              onClick={(event) => event.stopPropagation()}
                            >
                              업로드
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="newsletter-board-admin-page__row-actions">
                        {allowWriterSelect ? (
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
                        {actions.canEdit ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onEdit(board)
                            }}
                          >
                            이름 수정
                          </FormButton>
                        ) : null}
                        {actions.canDisable ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onDisable(board)
                            }}
                          >
                            사용 중지
                          </FormButton>
                        ) : null}
                        {actions.canEnable ? (
                          <FormButton
                            htmlType="button"
                            variant="primary"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onEnable(board)
                            }}
                          >
                            다시 사용
                          </FormButton>
                        ) : null}
                        {actions.canDelete ? (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            className="newsletter-board-admin-page__delete-btn"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onDelete(board)
                            }}
                          >
                            삭제
                          </FormButton>
                        ) : null}
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
