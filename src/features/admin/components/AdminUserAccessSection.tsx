import { useEffect, useState, type ReactNode } from 'react'
import {
  fetchAdminUserAccessContext,
  type AdminUserAccessContext,
} from '../../auth/authApi'
import {
  formatAdminAccessTime,
  formatAdminUnknownHistorySummary,
  formatAdminUserAppVersion,
  formatAdminUserChannel,
  formatAdminUserDevice,
  listAdminUsedChannelLabels,
  splitAdminAccessHistory,
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
    <div className="admin-user-access">
      {loading || error ? (
        <section className="admin-user-access__section" aria-label="접속 정보">
          <h3 className="admin-user-access__title">접속 정보</h3>
          <p className="admin-user-access__hint">{error || '불러오는 중…'}</p>
        </section>
      ) : null}
      {data ? <AdminUserAccessDetails data={data} /> : null}
    </div>
  )
}

/** 순수 표시 컴포넌트 (테스트 용이). 접속 정보 + 최근 접속 기록 두 섹션. */
export function AdminUserAccessDetails({ data }: { data: AdminUserAccessContext }) {
  const usedLabels = listAdminUsedChannelLabels(data.usedClientTypes ?? [])
  const { known, unknownCount } = splitAdminAccessHistory(data.recentSessions ?? [])
  const summary = formatAdminUnknownHistorySummary(unknownCount, known.length > 0)
  const items: { label: string; sub?: string; value: ReactNode; wide?: boolean }[] = [
    { label: '최근 로그인', sub: '로그인 기준', value: formatAdminAccessTime(data.lastLoginAt) },
    { label: '최근 접속', sub: '실제 사용 기준', value: formatAdminAccessTime(data.lastSeenAt) },
    { label: '최근 채널', value: formatAdminUserChannel(data.lastClientType) },
    {
      label: '최근 기기',
      value: (
        <span className="admin-user-access__ellipsis" title={formatAdminUserDevice(data.lastDeviceModel, data.lastClientType)}>
          {formatAdminUserDevice(data.lastDeviceModel, data.lastClientType)}
        </span>
      ),
    },
    { label: '앱 버전', value: formatAdminUserAppVersion(data.lastClientType, data.lastAppVersion) },
    { label: '최초 사용 채널', value: formatAdminUserChannel(data.firstClientType) },
    {
      label: '사용해 본 채널',
      wide: true,
      value:
        usedLabels.length > 0 ? (
          <span className="admin-user-access__chips">
            {usedLabels.map((l) => (
              <span key={l} className="admin-user-access__chip">
                {l}
              </span>
            ))}
          </span>
        ) : (
          formatAdminUserChannel(null)
        ),
    },
  ]
  return (
    <>
      <section className="admin-user-access__section" aria-label="접속 정보">
        <h3 className="admin-user-access__title">접속 정보</h3>
        <dl className="admin-user-access__grid">
          {items.map((it) => (
            <div
              key={it.label}
              className={`admin-user-access__item${it.wide ? ' admin-user-access__item--wide' : ''}`}
            >
              <dt>
                {it.label}
                {it.sub ? <span className="admin-user-access__sub"> ({it.sub})</span> : null}
              </dt>
              <dd>{it.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="admin-user-access__section" aria-label="최근 접속 기록">
        <h3 className="admin-user-access__title">최근 접속 기록</h3>
        {known.length > 0 ? (
          <div className="admin-user-access__table-wrap">
            <table className="admin-user-access__table">
              <colgroup>
                <col className="admin-user-access__col-time" />
                <col className="admin-user-access__col-channel" />
                <col />
                <col className="admin-user-access__col-version" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">일시</th>
                  <th scope="col">채널</th>
                  <th scope="col">기기</th>
                  <th scope="col">앱 버전</th>
                </tr>
              </thead>
              <tbody>
                {known.map((s, idx) => {
                  const device = formatAdminUserDevice(s.deviceModel, s.clientType)
                  return (
                    <tr key={`${s.createdAt}-${idx}`}>
                      <td>{formatAdminAccessTime(s.createdAt, true)}</td>
                      <td>{formatAdminUserChannel(s.clientType)}</td>
                      <td>
                        <span className="admin-user-access__ellipsis" title={device}>
                          {device}
                        </span>
                      </td>
                      <td>{formatAdminUserAppVersion(s.clientType, s.appVersion)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {summary ? <p className="admin-user-access__hint">{summary}</p> : null}
        {known.length === 0 && unknownCount === 0 ? (
          <p className="admin-user-access__hint">{formatAdminUserChannel(null)}</p>
        ) : null}
      </section>
    </>
  )
}
