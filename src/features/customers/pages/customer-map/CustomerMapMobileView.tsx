import type { CustomerMapViewProps } from '../../hooks/useCustomerMapState'
import CustomerMapShell from './CustomerMapShell'

export default function CustomerMapMobileView(props: CustomerMapViewProps) {
  return <CustomerMapShell variant="mobile" {...props} />
}
