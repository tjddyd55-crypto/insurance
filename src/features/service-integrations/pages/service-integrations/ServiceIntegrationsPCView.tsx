import type { ServiceIntegrationsViewProps } from '../../hooks/useServiceIntegrationsState'
import ServiceIntegrationCards from './ServiceIntegrationCards'

export default function ServiceIntegrationsPCView(props: ServiceIntegrationsViewProps) {
  return (
    <main className="page service-integrations-page service-integrations-page--pc page--with-back">
      <header className="service-integrations-page__header">
        <h1>서비스 연동</h1>
        <p>외부 서비스 연결은 이 화면에서만 관리합니다. 비밀 값은 브라우저에 저장하지 않습니다.</p>
      </header>
      <ServiceIntegrationCards {...props} />
    </main>
  )
}
