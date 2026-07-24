import { FormButton } from '../../../../components/form'
import type { PublicBoardWriterAccount } from '../../services/publicBoardWriter.service'

type WriterAccountTableProps = {
  writers: PublicBoardWriterAccount[]
  busy: boolean
  onEdit: (writer: PublicBoardWriterAccount) => void
  onDisable: (writer: PublicBoardWriterAccount) => void
  onEnable: (writer: PublicBoardWriterAccount) => void
}

function WriterStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? 'newsletter-board-writer-panel__status-badge newsletter-board-writer-panel__status-badge--active'
          : 'newsletter-board-writer-panel__status-badge newsletter-board-writer-panel__status-badge--inactive'
      }
    >
      {isActive ? 'ACTIVE' : 'INACTIVE'}
    </span>
  )
}

function resolveOrganizationName(writer: PublicBoardWriterAccount): string {
  const value = String(writer.organizationName ?? '').trim()
  return value || '—'
}

function resolveAuthorName(writer: PublicBoardWriterAccount): string {
  const name = String(writer.name ?? '').trim()
  if (name) {
    return name
  }
  return writer.loginId || '—'
}

export function WriterAccountTable({
  writers,
  busy,
  onEdit,
  onDisable,
  onEnable,
}: WriterAccountTableProps) {
  return (
    <>
      <div className="table-container table-container--desktop newsletter-board-writer-panel__desktop">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>소속명</th>
              <th>작성자 이름</th>
              <th>아이디</th>
              <th>비밀번호</th>
              <th>상태</th>
              <th className="admin-table-cell--actions">관리</th>
            </tr>
          </thead>
          <tbody>
            {writers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 20, color: 'var(--text-sub)' }}>
                  등록된 작성자 계정이 없습니다.
                </td>
              </tr>
            ) : (
              writers.map((writer) => (
                <tr key={writer.id}>
                  <td>{resolveOrganizationName(writer)}</td>
                  <td>{resolveAuthorName(writer)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{writer.loginId}</td>
                  <td>••••••••</td>
                  <td>
                    <div className="admin-table-actions" style={{ alignItems: 'center', gap: 8 }}>
                      <WriterStatusBadge isActive={writer.isActive} />
                      <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>
                        {writer.isActive ? '정상' : '사용 중지'}
                      </span>
                    </div>
                  </td>
                  <td className="admin-table-cell--actions">
                    <div className="admin-table-actions">
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        className="button button--secondary"
                        disabled={busy}
                        onClick={() => onEdit(writer)}
                      >
                        수정
                      </FormButton>
                      {writer.isActive ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="button button--secondary"
                          disabled={busy}
                          onClick={() => onDisable(writer)}
                        >
                          사용 중지
                        </FormButton>
                      ) : (
                        <FormButton
                          htmlType="button"
                          variant="primary"
                          className="button button--primary"
                          disabled={busy}
                          onClick={() => onEnable(writer)}
                        >
                          다시 사용
                        </FormButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-responsive-card-list newsletter-board-writer-panel__mobile">
        {writers.length === 0 ? (
          <p className="newsletter-board-writer-panel__muted">등록된 작성자 계정이 없습니다.</p>
        ) : (
          writers.map((writer) => (
            <article key={writer.id} className="admin-user-card">
              <div className="admin-user-card__row">
                <span className="admin-user-card__label">소속명</span>
                <span className="admin-user-card__value">{resolveOrganizationName(writer)}</span>
              </div>
              <div className="admin-user-card__row">
                <span className="admin-user-card__label">작성자 이름</span>
                <span className="admin-user-card__value">{resolveAuthorName(writer)}</span>
              </div>
              <div className="admin-user-card__row">
                <span className="admin-user-card__label">아이디</span>
                <span className="admin-user-card__value">{writer.loginId}</span>
              </div>
              <div className="admin-user-card__row">
                <span className="admin-user-card__label">비밀번호</span>
                <span className="admin-user-card__value">설정됨</span>
              </div>
              <div className="admin-user-card__row">
                <span className="admin-user-card__label">상태</span>
                <span className="admin-user-card__value">
                  <WriterStatusBadge isActive={writer.isActive} />{' '}
                  {writer.isActive ? '정상' : '사용 중지'}
                </span>
              </div>
              <div className="admin-user-card__actions">
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => onEdit(writer)}
                >
                  수정
                </FormButton>
                {writer.isActive ? (
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => onDisable(writer)}
                  >
                    사용 중지
                  </FormButton>
                ) : (
                  <FormButton
                    htmlType="button"
                    variant="primary"
                    className="button button--primary"
                    disabled={busy}
                    onClick={() => onEnable(writer)}
                  >
                    다시 사용
                  </FormButton>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </>
  )
}
