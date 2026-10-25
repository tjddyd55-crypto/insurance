import { useEffect, useState } from 'react'
import {
  fetchAdminUserAccessContext,
  type AdminUserAccessContext,
} from '../../auth/authApi'
import { formatAdminUserLastLogin } from '../adminUserPresentation'
import {
  formatAdminUserAppVersion,
  formatAdminUserChannel,
  formatAdminUserDevice,
  formatAdminUserRecentAccess,
} from '../adminUserAccessPresentation'

type Props = {
  token: string | null | undefined
  userId: string
  /** 테스트 주입용 */
  fetcher?: typeof fetchAdminUserAccessContext
}

/** 사용자 상세: 접속 채널·기기 (IP 미표시). PC/모바일 FormDialog 공용. */
export function AdminUserAccessSection({ token, userId, fetcher = fetchAdminUserAccessContext }: Props) {
  const requestKey = token?.trim() && userId ? `${userId}` : ''
  const [result, setResult] = useState<{
    key: string
    data: AdminUserAccessContext | null
    error: string
  }>({ key: '', data: null, error: '' })

  useEffect(() => {
    if (!requestKey || !token) return
    let cancelled = false
    fetcher(token, userId)
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: '접속 정보를 불러오지 못했습니다.' })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, token, userId, fetcher])

  const settled = result.key === requestKey
  const loading = Boolean(requestKey) && !settled
  const data = settled ? result.data : null
  const error = settled ? result.error : ''

  return (
    <section className="admin-modal-field admin-user-access" aria-label="접속 채널·기기">
      <span className="admin-user-card__label">접속 채널·기기</span>
      {loading ? <p className="admin-user-access__hint">불러오는 중…</p> : null}
      {error ? <p className="admin-user-access__hint">{error}</p> : null}
      {data ? <AdminUserAccessDetails data={data} /> : null}
    </section>
  )
}

/** 순수 표시 컴포넌트 (테스트 용이) */
export function AdminUserAccessDetails({ data }: { data: AdminUserAccessContext }) {
  return (
    <div style={{ marginTop: 6, color: 'var(--text-primary)' }}>
      <dl
        className="admin-user-access__grid"
        style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 12, rowGap: 4, margin: 0 }}
      >
        <dt>최근 접속</dt>
        <dd>
          {formatAdminUserRecentAccess({ last_seen_at: data.lastSeenAt, last_login_at: data.lastLoginAt })}
        </dd>
        <dt>최근 채널</dt>
        <dd>{formatAdminUserChannel(data.lastClientType)}</dd>
        <dt>최근 기기</dt>
        <dd>{formatAdminUserDevice(data.lastDeviceModel)}</dd>
        <dt>앱 버전</dt>
        <dd>{formatAdminUserAppVersion(data.lastClientType, data.lastAppVersion)}</dd>
        <dt>최초 사용 채널</dt>
        <dd>
          {formatAdminUserChannel(data.firstClientType)}
          <span className="admin-user-access__hint"> (기록 시작 이후 기준)</span>
        </dd>
        <dt>사용해 본 채널</dt>
        <dd>
          {data.usedClientTypes.length > 0
            ? data.usedClientTypes.map(formatAdminUserChannel).join(', ')
            : '미확인'}
        </dd>
      </dl>
      <p className="admin-user-access__hint" style={{ marginTop: 8 }}>
        최근 로그인 기록 (최대 20건)
      </p>
      {data.recentSessions.length === 0 ? (
        <p className="admin-user-access__hint">기록 없음</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-user-access__table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th scope="col">일시</th>
                <th scope="col">채널</th>
                <th scope="col">기기</th>
                <th scope="col">앱 버전</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSessions.map((s, idx) => (
                <tr key={`${s.createdAt}-${idx}`}>
                  <td>{formatAdminUserLastLogin(s.createdAt, true)}</td>
                  <td>{formatAdminUserChannel(s.clientType)}</td>
                  <td>{formatAdminUserDevice(s.deviceModel)}</td>
                  <td>{formatAdminUserAppVersion(s.clientType, s.appVersion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
