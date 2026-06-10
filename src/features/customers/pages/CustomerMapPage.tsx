import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCustomerMapState } from '../hooks/useCustomerMapState'
import CustomerMapMobileView from './customer-map/CustomerMapMobileView'
import CustomerMapPCView from './customer-map/CustomerMapPCView'

export default function CustomerMapPage() {
  const viewProps = useCustomerMapState()
  return <ResponsiveLayout PC={CustomerMapPCView} Mobile={CustomerMapMobileView} viewProps={viewProps} />
}
