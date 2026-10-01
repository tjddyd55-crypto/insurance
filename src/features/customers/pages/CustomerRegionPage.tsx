import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCustomerRegionState, type CustomerRegionViewProps } from '../hooks/useCustomerRegionState'
import CustomerRegionMobileView from './customer-region/CustomerRegionMobileView'
import CustomerRegionPCView from './customer-region/CustomerRegionPCView'
import './customer-region/customer-region-page.css'

export default function CustomerRegionPage() {
  const viewProps = useCustomerRegionState()
  return (
    <ResponsiveLayout<CustomerRegionViewProps>
      PC={CustomerRegionPCView}
      Mobile={CustomerRegionMobileView}
      viewProps={viewProps}
    />
  )
}
