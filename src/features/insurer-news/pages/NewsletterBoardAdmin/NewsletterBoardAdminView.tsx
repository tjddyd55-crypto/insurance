import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'

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
  const canCreatePublic = role === 'SUPER_ADMIN'

  return (
    <>
      <header className="page-header page-header--has-inline-back" style={{ marginBottom: 16 }}>
        <div className="page-header__title-row">
          <h1>소식지 메뉴 관리</h1>
        </div>
        <p className="insurer-news-muted">
          병원 소식지, 세무 소식지, 공지사항, 교육자료 같은 게시판 메뉴를 추가하거나 삭제합니다.
        </p>
      </header>

      <section className="settings-card" style={{ marginBottom: 16 }}>
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
          <label className="form-field" style={{ alignSelf: 'end' }}>
            <span className="form-label">공개 범위</span>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={!canCreatePublic}
                onChange={(event) => onPublicChange(event.target.checked)}
              />
              <span>공용 게시판</span>
            </label>
          </label>
        </div>
        <p className="insurer-news-muted" style={{ marginTop: 8 }}>
          공용은 모든 사용자가 볼 수 있고, 체크하지 않으면 현재 GA 사용자만 볼 수 있습니다.
          {!canCreatePublic ? ' 공용 게시판 생성은 최고 관리자만 가능합니다.' : ''}
        </p>
        <div style={{ marginTop: 12 }}>
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

      <section className="settings-card">
        <h2 style={{ marginTop: 0 }}>등록된 메뉴</h2>
        {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
        {!loading && boards.length === 0 ? (
          <div className="insurer-news-empty">등록된 소식지 메뉴가 없습니다.</div>
        ) : null}
        {!loading && boards.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>메뉴</th>
                  <th>범위</th>
                  <th>GA</th>
                  <th>경로</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {boards.map((board) => {
                  const canDelete = role === 'SUPER_ADMIN' || !board.isPublic
                  return (
                    <tr key={board.id}>
                      <td>{board.label}</td>
                      <td>{board.isPublic ? '공용' : 'GA 전용'}</td>
                      <td>{board.gaName || board.gaCode || '-'}</td>
                      <td>{`/portal/boards/${board.slug}`}</td>
                      <td>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="button button--secondary"
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
