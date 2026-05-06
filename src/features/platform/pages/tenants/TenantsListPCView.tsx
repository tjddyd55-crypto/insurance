import type { TenantsListViewProps } from './TenantsListPage'

export default function TenantsListPCView({ items, loading, error, reload }: TenantsListViewProps) {
  return (
    <main className="page platform-admin-page platform-admin-page--pc page--with-back">
      <header className="platform-admin-page__head">
        <h1 className="platform-admin-page__title">Tenant 목록</h1>
        <p className="platform-admin-page__lede">tenants · industry 연계 및 legacy_ga_id</p>
      </header>
      {error ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>{error}</p>
          <button type="button" className="platform-admin-page__btn" onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : null}
      {loading ? <p className="platform-admin-page__muted">불러오는 중…</p> : null}
      {!loading && !error ? (
        <div className="platform-admin-page__table-wrap">
          <table className="platform-admin-page__table">
            <thead>
              <tr>
                <th>테넌트 코드</th>
                <th>이름</th>
                <th>Industry</th>
                <th>상태</th>
                <th>legacy GA id</th>
                <th>tenant id</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td className="platform-admin-page__muted">{row.industryCode ?? '—'}</td>
                  <td>{row.status}</td>
                  <td className="platform-admin-page__mono">{row.legacyGaId ?? '—'}</td>
                  <td className="platform-admin-page__mono">{row.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="platform-admin-page__muted">행이 없습니다.</p> : null}
        </div>
      ) : null}
    </main>
  )
}
