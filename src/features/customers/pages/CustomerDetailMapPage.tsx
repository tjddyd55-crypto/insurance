import { useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCustomerDetailMapState } from '../hooks/useCustomerDetailMapState'
import CustomerDetailMapView, { type CustomerDetailMapViewProps } from './detail/CustomerDetailMapView'

function CustomerDetailMapPCView(props: Omit<CustomerDetailMapViewProps, 'variant'>) {
  return <CustomerDetailMapView variant="pc" {...props} />
}

function CustomerDetailMapMobileView(props: Omit<CustomerDetailMapViewProps, 'variant'>) {
  return <CustomerDetailMapView variant="mobile" {...props} />
}

export default function CustomerDetailMapPage() {
  const { customerId: rawId } = useParams()
  const customerId = Number(rawId)
  const validId = Number.isInteger(customerId) && customerId > 0
  const state = useCustomerDetailMapState(validId ? customerId : null)

  return (
    <ResponsiveLayout<Omit<CustomerDetailMapViewProps, 'variant'>>
      PC={CustomerDetailMapPCView}
      Mobile={CustomerDetailMapMobileView}
      viewProps={state}
    />
  )
}
