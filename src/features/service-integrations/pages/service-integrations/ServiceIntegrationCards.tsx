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

  return (
    <div className="service-integrations-page__body">
      {error ? <p className="service-integrations-page__error">{error}</p> : null}
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
                      {connected ? '다시 연동' : '연동'}
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={!connected || Boolean(busyKey)}
                      onClick={() => onDisconnect(provider)}
                    >
                      해제
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
