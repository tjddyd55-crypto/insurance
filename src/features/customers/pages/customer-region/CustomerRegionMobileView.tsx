import type { CustomerRegionViewProps } from '../../hooks/useCustomerRegionState'
import CustomerRegionBody from './CustomerRegionBody'

export default function CustomerRegionMobileView(props: CustomerRegionViewProps) {
  return (
    <main className="page customer-region-page customer-region-page--mobile page--with-back">
      <header className="customer-region-page__header">
        <h1>고객 지도</h1>
      </header>
      <CustomerRegionBody {...props} />
    </main>
  )
}
