import { useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCustomerMapState, type CustomerMapViewProps } from '../hooks/useCustomerMapState'
import CustomerMapShell from './customer-map/CustomerMapShell'
import './detail/customer-detail-map-page.css'

const DETAIL_FOCUS_UNAVAILABLE = '선택한 고객의 위치 정보를 확인할 수 없습니다.'

type DetailMapViewProps = CustomerMapViewProps

function CustomerDetailMapPCView(props: DetailMapViewProps) {
  return <CustomerMapShell variant="pc" embedInWorkspace {...props} />
}

function CustomerDetailMapMobileView(props: DetailMapViewProps) {
  return <CustomerMapShell variant="mobile" embedInWorkspace {...props} />
}

/**
 * 고객 상세「지도에서 보기」— 기존 `useCustomerMapState` 전체 로직(다중 마커·bounds·focus) 재사용.
 * 메뉴 `/customers/map` 과 데이터 SSOT 동일, 레이아웃만 workspace embed.
 */
export default function CustomerDetailMapPage() {
  const { customerId: rawId } = useParams()
  const customerId = Number(rawId)
  const validId = Number.isInteger(customerId) && customerId > 0
  const viewProps = useCustomerMapState({
    initialFocusCustomerId: validId ? customerId : null,
    openDetailInWorkspaceMap: true,
    focusUnavailableMessage: DETAIL_FOCUS_UNAVAILABLE,
  })

  return (
    <ResponsiveLayout<DetailMapViewProps>
      PC={CustomerDetailMapPCView}
      Mobile={CustomerDetailMapMobileView}
      viewProps={viewProps}
    />
  )
}
