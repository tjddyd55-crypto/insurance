import { Link } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import { canUseNewsletterBoardAdminRoutes } from '../../../auth/roleGuards'
import type { NewsletterBoard } from '../../types'
import {
  LOSS_ADJUSTER_PORTAL_PATH,
  buildNewsletterBoardUploadPath,
  buildNewsletterBoardViewPath,
  isLossAdjusterSystemMenuBoard,
} from '../../utils/newsletterBoardMenuLinks'
import { isGaOnlyNewsletterBoard } from '../../utils/newsletterBoardScope'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import { NewsletterBoardWriterPanel } from './NewsletterBoardWriterPanel'
import './newsletter-board-admin.css'

function boardScopeLabel(board: NewsletterBoard) {
  if (isLossAdjusterSystemMenuBoard(board)) return '기본'
  if (board.boardScope === 'global' || board.contentScope === 'global') return '공용 소식지'
  return '사용자 생성'
}

function boardPathLabel(board: NewsletterBoard) {
  if (isLossAdjusterSystemMenuBoard(board)) {
    return LOSS_ADJUSTER_PORTAL_PATH
  }
  return `/portal/boards/${board.slug}`
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
        <h1>{isSuperAdmin ? '소식지 관리' : 'GA전용 소식지 관리'}</h1>
        <p>
          {isSuperAdmin
            ? '원수사 소식지는 기존 고정 메뉴를 유지합니다. 손해사정사 소식지는 GA별 관리 목록에서 이름·사용 여부를 바꿀 수 있습니다.'
            : '손해사정사 기본 소식지와 현재 GA에서 만든 소식지를 관리합니다.'}
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
        ) : canManageGaBoards ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                GA전용 작성자 로그인
              </FormButton>
            </Link>
            <p className="newsletter-board-admin-page__help" style={{ margin: '8px 0 0' }}>
              글 업로드는 작성자 전용 계정으로 로그인한 뒤, 아래 목록의 「업로드」 또는 작성자 워크스페이스에서
              진행합니다. 손해사정사 기본 소식지는 기존 담당자 계정·경로를 그대로 사용합니다.
            </p>
          </div>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <section className="newsletter-board-admin-page__panel">
          <h2 className="newsletter-board-admin-page__panel-title">시스템 소식지</h2>
          <ul className="newsletter-board-admin-page__policy-list">
            <li>원수사 소식지 — `/portal/newsletters` (고정 유지, 이 목록에서 관리하지 않음)</li>
            <li>
              손해사정사 소식지 — `{LOSS_ADJUSTER_PORTAL_PATH}` (GA별 이름·사용 여부 관리, 게시글 type 유지)
            </li>
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
        {notice ? (
          <p className="status status--success" style={{ marginTop: 10 }} role="status">
            {notice}
          </p>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <BoardTable
          title="공용 소식지 목록"
          boards={globalBoards}
          loading={loading}
          busy={busy}
          canManageWriters
          showBoardQuickLinks
          includeUploadLink
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
          title="GA 소식지 목록"
          boards={gaBoards}
          loading={loading}
          busy={busy}
          canManageWriters={canManageWriters}
          showBoardQuickLinks
          includeUploadLink
          selectedBoardId={selectedBoard?.id ?? null}
          onDelete={onDelete}
          onDisable={onDisable}
          onEnable={onEnable}
          onEdit={onEdit}
          onSelectBoard={onSelectBoard}
          writerPanel={
            selectedBoard &&
            token.trim() &&
            !isLossAdjusterSystemMenuBoard(selectedBoard) &&
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
  canManageWriters = false,
  showBoardQuickLinks = false,
  includeUploadLink = false,
  selectedBoardId,
  onDelete,
  onDisable,
  onEnable,
  onEdit,
  onSelectBoard,
  writerPanel = null,
}: {
  title: string
  boards: NewsletterBoard[]
  loading: boolean
  busy: boolean
  canManageWriters?: boolean
  showBoardQuickLinks?: boolean
  includeUploadLink?: boolean
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
                <th>GA</th>
                <th>경로</th>
                <th>바로가기</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => {
                const isSystem = isLossAdjusterSystemMenuBoard(board)
                const isActive = board.isActive !== false
                const isSelected = selectedBoardId === board.id
                const allowWriterSelect = canManageWriters && !isSystem
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
                          isSystem
                            ? 'newsletter-board-admin-page__scope-badge newsletter-board-admin-page__scope-badge--system'
                            : 'newsletter-board-admin-page__scope-badge'
                        }
                      >
                        {boardScopeLabel(board)}
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
                    <td>{board.gaName ?? board.gaCode ?? '—'}</td>
                    <td className="newsletter-board-admin-page__path">{boardPathLabel(board)}</td>
                    <td>
                      {showBoardQuickLinks && isActive ? (
                        <div className="newsletter-board-admin-page__row-actions newsletter-board-admin-page__row-actions--links">
                          <Link
                            to={
                              isSystem
                                ? LOSS_ADJUSTER_PORTAL_PATH
                                : buildNewsletterBoardViewPath(board.slug)
                            }
                            className="button button--small button--secondary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            조회
                          </Link>
                          {!isSystem && (includeUploadLink || isGaOnlyNewsletterBoard(board)) ? (
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
                        {isSystem || !isActive ? (
                          isActive ? (
                            <FormButton
                              htmlType="button"
                              variant="secondary"
                              className="newsletter-board-admin-page__delete-btn"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation()
                                onDisable(board)
                              }}
                            >
                              사용 중지
                            </FormButton>
                          ) : (
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
                          )
                        ) : (
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
                        )}
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
