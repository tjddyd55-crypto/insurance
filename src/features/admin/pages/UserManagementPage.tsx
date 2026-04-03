import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  listAdminUsers,
  listGaCompanies,
  type AdminUserRow,
  type GaCompanyRow,
} from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

function formatCreatedAt(iso: string): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

export default function UserManagementPage() {
  const { user, token } = useAuth()
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaFilter, setGaFilter] = useState<number | 'all'>('all')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const gas = await listGaCompanies()
        if (!cancelled) {
          setGaList(gas)
        }
      } catch {
        if (!cancelled) {
          setLoadError('GA 목록을 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role])

  const loadUsers = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const users = await listAdminUsers(token, gaFilter === 'all' ? undefined : gaFilter)
      setRows(users)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role, gaFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>유저 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-user-management">
      <PageBackButton />
      <header className="page-header">
        <h1>유저 관리</h1>
        <p>{loadError || 'GA별로 사용자를 조회합니다.'}</p>
      </header>

      <section className="admin-user-management__toolbar card auth-card" style={{ maxWidth: 960, margin: '0 auto' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field__label">GA 선택</span>
          <select
            value={gaFilter === 'all' ? '' : String(gaFilter)}
            onChange={(e) => {
              const v = e.target.value
              setGaFilter(v === '' ? 'all' : Number(v))
            }}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            <option value="">전체</option>
            {gaList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div
        className="admin-user-management__table-wrap card"
        style={{
          maxWidth: 960,
          margin: '16px auto 0',
          padding: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          className="admin-user-table"
          style={{
            width: '100%',
            minWidth: '520px',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                GA 회사
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                아이디
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                역할
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                생성일
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
                  표시할 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.ga_company_name}-${r.username}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{r.ga_company_name}</td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', wordBreak: 'break-all' }}>
                    {r.username}
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{r.role}</td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCreatedAt(r.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
