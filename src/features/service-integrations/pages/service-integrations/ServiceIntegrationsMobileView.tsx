import type { ServiceIntegrationsViewProps } from '../../hooks/useServiceIntegrationsState'
import ServiceIntegrationCards from './ServiceIntegrationCards'

export default function ServiceIntegrationsMobileView(props: ServiceIntegrationsViewProps) {
  return (
    <main className="page service-integrations-page service-integrations-page--mobile page--with-back">
      <header className="service-integrations-page__header">
        <h1>서비스 연동</h1>
        <p>외부 서비스 연결 상태입니다.</p>
      </header>
      <ServiceIntegrationCards {...props} />
    </main>
  )
}
