import { Link } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

function scopeLabel(board: { contentScope?: string; isPublic?: boolean }) {
  const global = board.contentScope === 'global' || Boolean(board.isPublic)
  return global ? '전체 공용' : 'GA별 분리'
}

export function NewsletterBoardAdminView({
  role,
  boards,
  label,
  isPublic,
  loading,
  busy,
  error,
  onLabelChange,
  onPublicChange,
  onCreate,
  onDelete,
}: NewsletterBoardAdminViewProps) {
  const canCreateGlobal = role === 'SUPER_ADMIN'

  return (
    <>
      <section className="newsletter-board-admin-page__intro">
        <h1>소식지 메뉴 관리</h1>
        <p>
          병원·세무·교육자료 등 동적 게시판 메뉴를 추가합니다. 메뉴는 모든 GA에 공통으로 표시되며, 내용 범위만
          선택합니다.
        </p>
        {canCreateGlobal ? (
          <div className="newsletter-board-admin-page__toolbar" style={{ marginTop: 14 }}>
            <Link to="/admin/public-board-writers">
              <FormButton htmlType="button" variant="secondary">
                공용 작성자 계정 관리
              </FormButton>
            </Link>
            <Link to="/public-board-writer/login">
              <FormButton htmlType="button" variant="secondary">
                공용 작성자 로그인
              </FormButton>
            </Link>
          </div>
        ) : null}
      </section>

      <section className="newsletter-board-admin-page__panel">
        <h2 className="newsletter-board-admin-page__panel-title">메뉴 추가</h2>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span className="form-label">메뉴 이름</span>
            <FormInput
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder="예: 병원 소식지"
              maxLength={40}
            />
          </label>
          <div className="form-field">
            <span className="form-label">내용 범위</span>
            <label className="newsletter-board-admin-page__checkbox-row">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={!canCreateGlobal}
                onChange={(event) => onPublicChange(event.target.checked)}
              />
              <span>전체 공용 게시판</span>
            </label>
          </div>
        </div>
        <p className="newsletter-board-admin-page__help">
          체크하면 모든 GA가 같은 게시글을 봅니다. 공용 글 작성은 별도 공용 작성자 계정만 가능합니다.
          <br />
          체크하지 않으면 메뉴는 모든 GA에 보이지만, 내용은 각 GA별로 따로 관리됩니다.
          {!canCreateGlobal ? ' 전체 공용 메뉴 생성은 최고 관리자만 가능합니다.' : ''}
        </p>
        <div className="newsletter-board-admin-page__toolbar">
          <FormButton htmlType="button" variant="primary" disabled={busy || !label.trim()} onClick={onCreate}>
            {busy ? '추가 중...' : '메뉴 추가'}
          </FormButton>
        </div>
        {error ? (
          <p className="status status--error" style={{ marginTop: 10 }}>
            {error}
          </p>
        ) : null}
      </section>

      <section className="newsletter-board-admin-page__panel">
        <h2 className="newsletter-board-admin-page__panel-title">등록된 메뉴</h2>
        {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
        {!loading && boards.length === 0 ? (
          <div className="insurer-news-empty">등록된 소식지 메뉴가 없습니다.</div>
        ) : null}
        {!loading && boards.length > 0 ? (
          <div className="newsletter-board-admin-page__table-wrap">
            <table className="newsletter-board-admin-page__table">
              <thead>
                <tr>
                  <th>메뉴명</th>
                  <th>내용 범위</th>
                  <th>경로</th>
                  <th>공용 작성</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {boards.map((board) => {
                  const global = board.contentScope === 'global' || board.isPublic
                  const canDelete = role === 'SUPER_ADMIN' || !global
                  return (
                    <tr key={board.id}>
                      <td>{board.label}</td>
                      <td>
                        <span
                          className={`newsletter-board-admin-page__scope-badge${
                            global ? ' newsletter-board-admin-page__scope-badge--global' : ''
                          }`}
                        >
                          {scopeLabel(board)}
                        </span>
                      </td>
                      <td className="newsletter-board-admin-page__path">{`/portal/boards/${board.slug}`}</td>
                      <td>{global ? '공용 작성자 전용' : 'GA 사용자'}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  )
}
