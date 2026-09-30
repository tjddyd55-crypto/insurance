import { useMemo, useState } from 'react'

import {
  buildMenuPermissionMatrix,
  buildSecondaryChannelMatrix,
  MENU_AUDIENCE_LABELS,
  PRIMARY_MATRIX_AUDIENCES,
  SECONDARY_MATRIX_AUDIENCES,
  statusDisplayLabel,
  statusesEqualAcrossPrimaryAudiences,
} from './menuPermissionMatrix'
import type { MenuAudienceId, MenuPermissionCell, MenuPermissionRow, PaidAccessMode } from './menuPermissionMatrix.types'
import './menu-permission-matrix.css'

type FilterMode = 'all' | 'user' | 'staff_admin' | 'conditional' | 'diff'

function rowMatchesFilter(row: MenuPermissionRow, filter: FilterMode): boolean {
  if (filter === 'all') return true
  if (filter === 'diff') return !statusesEqualAcrossPrimaryAudiences(row)
  if (filter === 'conditional') {
    return PRIMARY_MATRIX_AUDIENCES.some((id) => row.cells[id]?.status === 'conditional')
  }
  if (filter === 'user') {
    return (
      row.cells.GENERAL_USER?.status !== 'hidden' ||
      row.cells.GA_USER?.status !== 'hidden'
    )
  }
  return row.cells.GA_STAFF?.status !== 'hidden' || row.cells.GA_ADMIN?.status !== 'hidden'
}

function CellBadge({ cell }: { cell: MenuPermissionCell }) {
  const label = statusDisplayLabel(cell.status, cell)
  const title = [cell.reason, cell.badge, cell.featureKey ? `feature: ${cell.featureKey}` : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <span className={`menu-perm-matrix__status menu-perm-matrix__status--${cell.status}`} title={title || undefined}>
      {cell.status === 'blocked' && cell.badge ? cell.badge : label}
    </span>
  )
}

export default function MenuPermissionMatrixPage() {
  const [paidAccessMode, setPaidAccessMode] = useState<PaidAccessMode>('active')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [detailRow, setDetailRow] = useState<MenuPermissionRow | null>(null)

  const matrix = useMemo(() => buildMenuPermissionMatrix({ paidAccessMode }), [paidAccessMode])
  const secondary = useMemo(() => buildSecondaryChannelMatrix({ paidAccessMode }), [paidAccessMode])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return matrix.rows.filter((row) => {
      if (!rowMatchesFilter(row, filter)) return false
      if (!q) return true
      return (
        row.menuLabel.toLowerCase().includes(q) ||
        row.primaryPath.toLowerCase().includes(q) ||
        (row.section?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [matrix.rows, filter, search])

  return (
    <main className="page menu-perm-matrix">
      <header className="page-header">
        <h1>메뉴 권한 SSOT</h1>
        <p className="menu-perm-matrix__lead">
          현재 계정 유형별 메뉴 노출 및 접근 정책을 실제 메뉴 SSOT 기준으로 표시합니다.
        </p>
        <p className="menu-perm-matrix__sub">실제 메뉴 정책이 변경되면 이 표에도 자동 반영됩니다.</p>
      </header>

      <div className="menu-perm-matrix__summary">
        {matrix.summaries.map((summary) => (
          <div key={summary.id} className="menu-perm-matrix__summary-card">
            <div className="menu-perm-matrix__summary-title">{summary.title}</div>
            <div className="menu-perm-matrix__summary-count">{summary.linkCount}개</div>
            <div className="menu-perm-matrix__summary-meta">
              노출 {summary.visibleCount} · 제한 {summary.blockedCount} · 개발중 {summary.disabledCount}
            </div>
          </div>
        ))}
      </div>

      <div className="menu-perm-matrix__toolbar card">
        <input
          className="menu-perm-matrix__search"
          type="search"
          placeholder="메뉴명 또는 경로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="메뉴명 또는 경로 검색"
        />
        <div className="menu-perm-matrix__filters" role="tablist" aria-label="표 필터">
          {(
            [
              ['all', '전체'],
              ['user', 'USER'],
              ['staff_admin', 'STAFF/ADMIN'],
              ['conditional', '조건부만'],
              ['diff', '차이만 보기'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`menu-perm-matrix__filter-btn${filter === id ? ' is-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="menu-perm-matrix__paid">
          <span>권한 기준</span>
          <select value={paidAccessMode} onChange={(e) => setPaidAccessMode(e.target.value as PaidAccessMode)}>
            <option value="active">활성 이용권 기준</option>
            <option value="free">무료/미결제 기준</option>
          </select>
        </label>
      </div>

      <div className="menu-perm-matrix__legend card">
        <span>○ 노출/접근 가능</span>
        <span>× 미노출</span>
        <span>제한 entitlement</span>
        <span>개발중 disabled</span>
        <span>조건부 context/환경</span>
      </div>

      <div className="menu-perm-matrix__table-wrap card">
        <table className="menu-perm-matrix__table">
          <thead>
            <tr>
              <th className="menu-perm-matrix__sticky-col">대분류</th>
              <th className="menu-perm-matrix__sticky-col menu-perm-matrix__sticky-col--menu">메뉴</th>
              {PRIMARY_MATRIX_AUDIENCES.map((id) => (
                <th key={id}>
                  <div>{MENU_AUDIENCE_LABELS[id].title}</div>
                  <div className="menu-perm-matrix__th-sub">{MENU_AUDIENCE_LABELS[id].subtitle}</div>
                </th>
              ))}
              <th>경로</th>
              <th>정책/비고</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.rowKey} className="menu-perm-matrix__row" onClick={() => setDetailRow(row)}>
                <td className="menu-perm-matrix__sticky-col">
                  {row.sectionMissing ? (
                    <span className="menu-perm-matrix__warn" title="메뉴가 section 없이 배치됨">
                      대분류 없음 ⚠
                    </span>
                  ) : (
                    (row.section ?? '—')
                  )}
                </td>
                <td className="menu-perm-matrix__sticky-col menu-perm-matrix__sticky-col--menu">{row.menuLabel}</td>
                {PRIMARY_MATRIX_AUDIENCES.map((id) => (
                  <td key={id}>
                    <CellBadge cell={row.cells[id]} />
                  </td>
                ))}
                <td className="menu-perm-matrix__path">{row.primaryPath}</td>
                <td className="menu-perm-matrix__notes">
                  {row.labelNotes}
                  {row.cells.GA_USER?.status === 'blocked' && row.cells.GA_USER.badge ? row.cells.GA_USER.badge : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="menu-perm-matrix__secondary">
        <h2>채널 전용 계정 (INSURER_MANAGER / LOSS_ADJUSTER)</h2>
        <div className="menu-perm-matrix__table-wrap card">
          <table className="menu-perm-matrix__table menu-perm-matrix__table--compact">
            <thead>
              <tr>
                <th>메뉴</th>
                {SECONDARY_MATRIX_AUDIENCES.map((id) => (
                  <th key={id}>{MENU_AUDIENCE_LABELS[id].title}</th>
                ))}
                <th>경로</th>
              </tr>
            </thead>
            <tbody>
              {secondary.rows.map((row) => (
                <tr key={row.rowKey}>
                  <td>{row.menuLabel}</td>
                  {SECONDARY_MATRIX_AUDIENCES.map((id) => (
                    <td key={id}>
                      <CellBadge cell={row.cells[id]} />
                    </td>
                  ))}
                  <td className="menu-perm-matrix__path">{row.primaryPath}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="menu-perm-matrix__footer card">
        <h2>정책 소스</h2>
        <ul>
          <li>Menu SSOT: <code>buildAppMenuForSession</code> (gaTenantMenu.ts)</li>
          <li>Feature entitlement: <code>featureEntitlementPolicy</code> · <code>applyEntitlementMenuBadges</code></li>
          <li>Role guard: <code>roleGuards</code> (admin route eligibility)</li>
        </ul>
        <p>조회 전용 — 메뉴 정책 변경은 코드·entitlement·role guard SSOT에서 수행합니다.</p>
      </footer>

      {detailRow ? (
        <div className="menu-perm-matrix__drawer-backdrop" role="presentation" onClick={() => setDetailRow(null)}>
          <aside
            className="menu-perm-matrix__drawer"
            role="dialog"
            aria-label={`${detailRow.menuLabel} 상세`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h3>{detailRow.menuLabel}</h3>
              <button type="button" onClick={() => setDetailRow(null)}>
                닫기
              </button>
            </header>
            <p>
              <strong>경로</strong> {detailRow.primaryPath}
            </p>
            {detailRow.labelNotes ? <p>{detailRow.labelNotes}</p> : null}
            <ul>
              {PRIMARY_MATRIX_AUDIENCES.map((id: MenuAudienceId) => {
                const cell = detailRow.cells[id]
                return (
                  <li key={id}>
                    {MENU_AUDIENCE_LABELS[id].title}: {cell.status}
                    {cell.reason ? ` — ${cell.reason}` : ''}
                    {cell.featureKey ? ` (${cell.featureKey})` : ''}
                  </li>
                )
              })}
            </ul>
          </aside>
        </div>
      ) : null}
    </main>
  )
}
