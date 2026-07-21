import CustomerMapCanvas from '../../components/map/CustomerMapCanvas'
import MapProviderLoader from '../../components/map/MapProviderLoader'
import { mapSdkErrorMessage } from '../../components/map/mapSdkErrors'
import type { CustomerDetailMapState } from '../../hooks/useCustomerDetailMapState'
import './customer-detail-map-page.css'

export type CustomerDetailMapViewProps = CustomerDetailMapState & {
  variant: 'pc' | 'mobile'
}

export default function CustomerDetailMapView({
  variant,
  status,
  error,
  customer,
  mapCustomers,
  centerLat,
  centerLng,
  zoom,
  selectedGroupKey,
  autoFitKey,
  statusMessage,
  onViewportChange,
  onBoundsIdle,
  onSelectMarkerGroup,
}: CustomerDetailMapViewProps) {
  const name = customer?.name?.trim() || '선택 고객'
  const address = String(customer?.address ?? '').trim()

  return (
    <main
      className={`page customer-detail-map-page customer-detail-map-page--${variant} page--with-back`}
      aria-label="선택 고객 지도"
    >
      <header className="customer-detail-map-page__header">
        <h2 className="customer-detail-map-page__title">선택 고객 지도</h2>
        <p className="customer-detail-map-page__name">{name}</p>
        {address ? (
          <p className="customer-detail-map-page__address">{address}</p>
        ) : (
          <p className="customer-detail-map-page__address customer-detail-map-page__address--empty">
            등록된 주소가 없습니다.
          </p>
        )}
        {statusMessage && status !== 'no_address' ? (
          <p className="customer-detail-map-page__status" role="status">
            {statusMessage}
          </p>
        ) : null}
        {error ? (
          <p className="customer-detail-map-page__status customer-detail-map-page__status--error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="customer-detail-map-page__map-section" aria-label="지도">
        {status === 'loading' ? (
          <div className="customer-detail-map-page__placeholder" role="status">
            지도를 불러오는 중…
          </div>
        ) : status === 'ready' ? (
          <div className="customer-detail-map-page__map-frame">
            <MapProviderLoader>
              {({ provider, clientKey, ready, error: sdkError, errorCode }) => {
                if (ready && provider !== 'none' && clientKey) {
                  return (
                    <CustomerMapCanvas
                      provider={provider}
                      clientKey={clientKey}
                      customers={mapCustomers}
                      centerLat={centerLat}
                      centerLng={centerLng}
                      zoom={zoom}
                      selectedGroupKey={selectedGroupKey}
                      autoFitKey={autoFitKey}
                      onViewportChange={onViewportChange}
                      onBoundsIdle={onBoundsIdle}
                      onSelectMarkerGroup={onSelectMarkerGroup}
                    />
                  )
                }
                return (
                  <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
                    <p className="customer-map-setup-notice__title">지도 설정이 필요합니다</p>
                    <p className="customer-map-setup-notice__body">
                      {sdkError ?? mapSdkErrorMessage(errorCode ?? 'missing_client_id')}
                    </p>
                  </div>
                )
              }}
            </MapProviderLoader>
          </div>
        ) : (
          <div className="customer-detail-map-page__placeholder" role="status">
            {statusMessage ?? error ?? '지도를 표시할 수 없습니다.'}
          </div>
        )}
      </section>
    </main>
  )
}
