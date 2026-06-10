import type { CustomerMapViewProps } from '../../hooks/useCustomerMapState'
import CustomerMapShell from './CustomerMapShell'

export default function CustomerMapPCView(props: CustomerMapViewProps) {
  return <CustomerMapShell variant="pc" {...props} />
}
