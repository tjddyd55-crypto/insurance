import { Link } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoard } from '../../types'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

function boardScopeLabel(board: NewsletterBoard) {
  if (board.boardScope === 'global' || board.contentScope === 'global') return '공용게시판'
  return 'GA전용게시판'
}

export function NewsletterBoardAdminView({
  role,
  globalBoards,
  gaBoards,
  label,
  description,
  createMode,
  loading,
  busy,
  error,
  onLabelChange,
  onDescriptionChange,
  onCreateModeChange,
  onCreate,
  onDelete,
}: NewsletterBoardAdminViewProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const isGaAdmin = role === 'GA_ADMIN'

  return (
    <>
      <section className="newsletter-board-admin-page__intro">
        <h1>{isSuperAdmin ? '소식지·게시판 관리' : 'GA전용게시판 관리'}</h1>
        <p>
          {isSuperAdmin
            ? '시스템 게시판(원수사·손해사정사)은 기존 메뉴를 유지합니다. 공용게시판은 모든 GA에 노출됩니다.'
            : '현재 GA에만 메뉴가 표시되는 게시판을 관리합니다.'}
        </p>
        {isSuperAdmin ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/admin/public-board-writers">
              <FormButton htmlType="button" variant="secondary">
                공용 작성자 계정 관리
              </FormButton>
            </Link>
            <Link to="/board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                게시판 작성자 로그인
              </FormButton>
            </Link>
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
          <h2 className="newsletter-board-admin-page__panel-title">시스템 게시판</h2>
          <ul className="newsletter-board-admin-page__policy-list">
            <li>원수사 소식지 — `/portal/newsletters` (기존 유지)</li>
            <li>손해사정사 소식지 — `/portal/adjuster-news` (기존 유지)</li>
          </ul>
        </section>
      ) : null}

      <section className="newsletter-board-admin-page__panel">
        <h2 className="newsletter-board-admin-page__panel-title">
          {isSuperAdmin ? '공용게시판 추가' : 'GA전용게시판 추가'}
        </h2>
        {isSuperAdmin ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginBottom: 12 }}>
            <FormButton
              htmlType="button"
              variant={createMode === 'global' ? 'primary' : 'secondary'}
              onClick={() => onCreateModeChange('global')}
            >
              공용게시판 추가
            </FormButton>
          </div>
        ) : null}
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span className="form-label">게시판명</span>
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
            ? '공용게시판: 모든 GA에 메뉴가 표시되고, 모든 GA가 같은 글을 봅니다. 작성자는 전체 관리자가 게시판별로 별도 부여합니다.'
            : 'GA전용게시판: 현재 GA에만 메뉴가 표시되고, 현재 GA 안에서만 글을 봅니다. 작성자는 GA 관리자가 게시판별로 별도 부여합니다.'}
        </p>
        <div className="newsletter-board-admin-page__toolbar">
          <FormButton htmlType="button" variant="primary" disabled={busy || !label.trim()} onClick={onCreate}>
            {busy ? '추가 중...' : isSuperAdmin && createMode === 'global' ? '공용게시판 추가' : 'GA전용게시판 추가'}
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
          title="공용게시판 목록"
          boards={globalBoards}
          loading={loading}
          busy={busy}
          canDelete
          onDelete={onDelete}
        />
      ) : null}

      <BoardTable
        title={isGaAdmin ? 'GA전용게시판 목록' : 'GA전용게시판 현황'}
        boards={gaBoards}
        loading={loading}
        busy={busy}
        canDelete={isGaAdmin || isSuperAdmin}
        onDelete={onDelete}
      />
    </>
  )
}

function BoardTable({
  title,
  boards,
  loading,
  busy,
  canDelete,
  onDelete,
}: {
  title: string
  boards: NewsletterBoard[]
  loading: boolean
  busy: boolean
  canDelete: boolean
  onDelete: (board: NewsletterBoard) => void
}) {
  return (
    <section className="newsletter-board-admin-page__panel">
      <h2 className="newsletter-board-admin-page__panel-title">{title}</h2>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {!loading && boards.length === 0 ? <div className="insurer-news-empty">등록된 게시판이 없습니다.</div> : null}
      {!loading && boards.length > 0 ? (
        <div className="newsletter-board-admin-page__table-wrap">
          <table className="newsletter-board-admin-page__table">
            <thead>
              <tr>
                <th>게시판명</th>
                <th>유형</th>
                <th>GA</th>
                <th>경로</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => (
                <tr key={board.id}>
                  <td>{board.label}</td>
                  <td>
                    <span className="newsletter-board-admin-page__scope-badge">{boardScopeLabel(board)}</span>
                  </td>
                  <td>{board.gaName ?? board.gaCode ?? '—'}</td>
                  <td className="newsletter-board-admin-page__path">{`/portal/boards/${board.slug}`}</td>
                  <td>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      className="newsletter-board-admin-page__delete-btn"
                      disabled={busy || !canDelete}
                      onClick={() => onDelete(board)}
                    >
                      삭제
                    </FormButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
