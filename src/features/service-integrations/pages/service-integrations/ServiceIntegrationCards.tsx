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

function connectLabel(provider: ServiceIntegrationCard, connected: boolean): string {
  if (provider.key === 'google_calendar') {
    return connected ? '다시 연결' : 'Google 연결'
  }
  return connected ? '다시 연동' : '연동'
}

/** 한 Google 연결로 쓰는 제품. 서버 products 가 없으면(이전 응답) Calendar 만 있는 것으로 본다. */
function googleProductsInUse(provider: ServiceIntegrationCard): string {
  const calendar = provider.products ? provider.products.calendar.status === 'available' : provider.status === 'connected'
  const tasks = provider.products?.tasks.status === 'available'
  const names = [calendar ? 'Google Calendar' : '', tasks ? 'Google Tasks' : ''].filter(Boolean)
  return names.length > 0 ? `${names.join(' · ')} (읽기 전용)` : '없음'
}

function googleTasksNeedReconsent(provider: ServiceIntegrationCard): boolean {
  return provider.status === 'connected'
    && Boolean(provider.needsReconsent || provider.products?.tasks.status === 'scope_missing')
}

function GoogleAccountMeta({ provider }: { provider: ServiceIntegrationCard }) {
  if (provider.status === 'disconnected' || provider.status === 'unconfigured') {
    return null
  }
  return (
    <>
      <div>
        <dt>계정</dt>
        <dd>{provider.accountLabel || '없음'}</dd>
      </div>
      <div>
        <dt>연결 시각</dt>
        <dd>{formatSyncedAt(provider.connectedAt ?? null)}</dd>
      </div>
      <div>
        <dt>사용 중</dt>
        <dd>{provider.status === 'connected' ? googleProductsInUse(provider) : '다시 연결 필요'}</dd>
      </div>
    </>
  )
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
              const connected = provider.status === 'connected' || provider.status === 'error' || provider.status === 'needs_reauth'
              const isGoogle = provider.key === 'google_calendar'
              // 검증(Testing) 기간 허용 목록 밖: Google 동의 화면으로 보내지 않는다. 이미 연결된 경우 해제는 그대로.
              const googleNotReady = isGoogle && provider.connectAllowed === false
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
                  {isGoogle && provider.status === 'needs_reauth' ? (
                    <p className="service-integrations-page__error" role="alert">
                      Google 연결이 만료되었거나 권한이 취소되었습니다. 다시 연결해 주세요.
                    </p>
                  ) : null}
                  {isGoogle && googleTasksNeedReconsent(provider) ? (
                    <p className="service-integrations-page__notice" role="status">
                      Google Tasks 읽기 권한이 없습니다. 다시 연결하면 Google 할 일도 일정 관리에서 볼 수 있습니다.
                    </p>
                  ) : null}
                  {isGoogle && provider.status === 'error' ? (
                    <p className="service-integrations-page__error" role="alert">
                      Google 연결 상태를 확인하지 못했습니다. 다시 연결해 주세요.
                    </p>
                  ) : null}
                  <dl className="service-integrations-page__meta">
                    {isGoogle ? <GoogleAccountMeta provider={provider} /> : null}
                    <div>
                      <dt>{isGoogle ? '마지막 조회' : '마지막 동기화'}</dt>
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
                      disabled={unconfigured || googleNotReady || Boolean(busyKey)}
                      onClick={() => onConnect(provider)}
                    >
                      {googleNotReady ? 'Google 연동 준비 중' : connectLabel(provider, connected)}
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={!connected || Boolean(busyKey)}
                      onClick={() => onDisconnect(provider)}
                    >
                      {isGoogle ? '연결 해제' : '해제'}
                    </FormButton>
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
