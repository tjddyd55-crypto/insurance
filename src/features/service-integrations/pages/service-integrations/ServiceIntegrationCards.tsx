import { FormButton } from '../../../../components/form'
import {
  SERVICE_INTEGRATION_STATUS_LABEL,
  type ServiceIntegrationCard,
} from '../../api/serviceIntegrationsApi'
import type { ServiceIntegrationsViewProps } from '../../hooks/useServiceIntegrationsState'

function formatSyncedAt(value: string | null): string {
  if (!value) {
    return '없음'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '없음'
  }
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const yes = (on: boolean) => (on ? '허용' : '미허용')

/** t311: Google 카드에 보여 줄 기능별 권한 줄. 플래그가 꺼진 기능은 줄을 만들지 않는다. */
function googleGrantRows(provider: ServiceIntegrationCard): Array<[string, string]> {
  const g = provider.grants
  if (!g || provider.status !== 'connected') return []
  if (provider.key === 'google_drive') return [['Drive 파일', yes(g.drive)]]
  const rows: Array<[string, string]> = [['일정·할 일 읽기', `Calendar ${yes(g.calendarRead)} · Tasks ${yes(g.tasksRead)}`]]
  if (g.writeEnabled) rows.push(['일정·할 일 쓰기', `Calendar ${yes(g.calendarWrite)} · Tasks ${yes(g.tasksWrite)}`])
  return rows
}

/** 연결된 Google 카드에서 아직 받지 못한 권한이 있으면 버튼이 그 권한을 요청한다. */
function connectLabel(provider: ServiceIntegrationCard, connected: boolean): string {
  const g = provider.grants
  if (provider.key === 'google_drive') return g?.drive ? '다시 연동' : connected ? 'Drive 권한 허용' : '연동'
  if (connected && g?.writeEnabled && !(g.calendarWrite && g.tasksWrite)) return '쓰기 권한 추가'
  return connected ? '다시 연동' : '연동'
}

function groupProviders(providers: ServiceIntegrationCard[]) {
  const groups: Array<{ label: string; items: ServiceIntegrationCard[] }> = []
  for (const provider of providers) {
    const current = groups[groups.length - 1]
    if (!current || current.label !== provider.groupLabel) {
      groups.push({ label: provider.groupLabel, items: [provider] })
      continue
    }
    current.items.push(provider)
  }
  return groups
}

export default function ServiceIntegrationCards({
  loading,
  error,
  notice,
  balanceText,
  providers,
  busyKey,
  onConnect,
  onDisconnect,
  onOpenSettings,
  onRefreshBalance,
}: ServiceIntegrationsViewProps) {
  if (loading) {
    return <p className="service-integrations-page__status">연동 상태를 불러오는 중…</p>
  }

  if (providers.length === 0) {
    return (
      <div className="service-integrations-page__body">
        {error ? (
          <p className="service-integrations-page__error" role="alert">{error}</p>
        ) : (
          <p className="service-integrations-page__empty" role="status">연동 제공자 목록이 비어 있습니다.</p>
        )}
      </div>
    )
  }

  return (
    <div className="service-integrations-page__body">
      {error ? <p className="service-integrations-page__error" role="alert">{error}</p> : null}
      {notice ? <p className="service-integrations-page__notice">{notice}</p> : null}
      {groupProviders(providers).map((group) => (
        <section key={group.label} className="service-integrations-page__group" aria-label={group.label}>
          <h2>{group.label}</h2>
          <div className="service-integrations-page__grid">
            {group.items.map((provider) => {
              const unconfigured = provider.status === 'unconfigured'
              const connected = provider.status === 'connected' || provider.status === 'error'
              return (
                <article key={provider.key} className="service-integrations-page__card">
                  <div className="service-integrations-page__card-head">
                    <span className="service-integrations-page__mark" aria-hidden="true">
                      {provider.name.slice(0, 1)}
                    </span>
                    <div>
                      <h3>{provider.name}</h3>
                      <p className={`service-integrations-page__status-pill service-integrations-page__status-pill--${provider.status}`}>
                        {SERVICE_INTEGRATION_STATUS_LABEL[provider.status]}
                      </p>
                    </div>
                  </div>
                  <p className="service-integrations-page__desc">{provider.description}</p>
                  <dl className="service-integrations-page__meta">
                    <div>
                      <dt>마지막 동기화</dt>
                      <dd>{formatSyncedAt(provider.lastSyncedAt)}</dd>
                    </div>
                    {provider.kind === 'aligo' ? (
                      <>
                        <div>
                          <dt>발신번호</dt>
                          <dd>{provider.sender || '없음'}</dd>
                        </div>
                        <div>
                          <dt>아이디</dt>
                          <dd>{provider.accountLabel || '없음'}</dd>
                        </div>
                        <div>
                          <dt>잔액</dt>
                          <dd>{balanceText || '조회 전'}</dd>
                        </div>
                      </>
                    ) : null}
                    {provider.grants && provider.accountLabel ? (
                      <div>
                        <dt>Google 계정</dt>
                        <dd>{provider.accountLabel}</dd>
                      </div>
                    ) : null}
                    {googleGrantRows(provider).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                    {provider.secretMasked ? (
                      <div>
                        <dt>자격 증명</dt>
                        <dd>{provider.secretMasked}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="service-integrations-page__actions">
                    {provider.kind === 'aligo' ? (
                      <FormButton htmlType="button" variant="secondary" onClick={onRefreshBalance}>
                        잔액
                      </FormButton>
                    ) : null}
                    <FormButton
                      htmlType="button"
                      variant="primary"
                      disabled={unconfigured || Boolean(busyKey)}
                      onClick={() => onConnect(provider)}
                    >
                      {connectLabel(provider, connected || Boolean(provider.key === 'google_drive' && provider.accountLabel))}
                    </FormButton>
                    {provider.key === 'google_drive' ? null : <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={!connected || Boolean(busyKey)}
                      onClick={() => onDisconnect(provider)}
                    >
                      해제
                    </FormButton>}
                    {provider.settingsPath ? (
                      <FormButton htmlType="button" variant="secondary" onClick={() => onOpenSettings(provider)}>
                        설정
                      </FormButton>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
