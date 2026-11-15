import { Link } from 'react-router-dom'
import { useHealthwayEnabled } from '../useHealthwayEnabled'
export function HealthwayCustomerEntry({ customerId }: { customerId: number }) {
  const enabled = useHealthwayEnabled()
  return enabled ? <Link className="button button--secondary customer-mobile-action-btn" to={`/customers/${customerId}/healthway`}>건강정보</Link> : null
}
