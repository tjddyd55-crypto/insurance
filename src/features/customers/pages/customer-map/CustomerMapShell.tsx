import { useAuth } from '../../../auth/AuthProvider'
import { FormButton, FormInput } from '../../../../components/form'
import CustomerMapCanvas from '../../components/map/CustomerMapCanvas'
import CustomerMapCustomerList from '../../components/map/CustomerMapCustomerList'
import CustomerMapMarkerCard from '../../components/map/CustomerMapMarkerCard'
import CustomerStaticMapImage from '../../components/map/CustomerStaticMapImage'
import MapProviderLoader from '../../components/map/MapProviderLoader'
import { CUSTOMER_MAP_RADIUS_OPTIONS_KM } from '../../config/customerMap.config'
import type { CustomerMapViewProps } from '../../hooks/useCustomerMapState'
import './customer-map-page.css'

type CustomerMapShellProps = CustomerMapViewProps & {
  variant: 'pc' | 'mobile'
}

export default function CustomerMapShell({
  variant,
  loading,
  error,
  mapCustomers,
  staticMap,
  stats,
  mapQuery,
  radiusKm,
  favoriteOnly,
  keyword,
  viewportCenterLat,
  viewportCenterLng,
  viewportZoom,
  selectedCustomerId,
  selectedCustomer,
  onRadiusChange,
  onShowAllCustomers,
  onCurrentLocation,
  onOpenCustomerDetail,
  onFavoriteOnlyChange,
  onKeywordChange,
  onSelectCustomer,
  onViewportChange,
}: CustomerMapShellProps) {
  const { token } = useAuth()
  const modifier = variant === 'pc' ? 'customers-map-page--pc' : 'customers-map-page--mobile'
  const hasMarkers = mapCustomers.length > 0

  return (
    <main className={`page customers-map-page ${modifier} page--with-back`}>
      <header className="customers-map-page__header">
        <h1 className="customers-map-page__title">고객 지도</h1>
        <p className="customers-map-page__notice">
          주소가 좌표로 변환된 고객만 지도에 표시됩니다.
        </p>
        {stats ? (
          <p className="customers-map-page__stats">
            지도 표시 {stats.displayedOnMap}명 / 좌표 있음 {stats.withLocation}명 · 주소 없음{' '}
            {stats.missingAddress}명 · 변환 실패 {stats.geocodeFailed}명
          </p>
        ) : null}
        {stats && stats.hiddenByLimit > 0 ? (
          <p className="customers-map-page__limit-notice" role="status">
            좌표가 있는 고객이 많아 지도에는 최대 {staticMap?.maxMarkerCount ?? 20}명만 번호
            마커로 표시됩니다. ({stats.hiddenByLimit}명은 목록에서 제외)
          </p>
        ) : null}
      </header>

      <div className="customers-map-page__toolbar">
        <div className="customers-map-page__toolbar-row">
          <FormButton htmlType="button" variant="secondary" onClick={onCurrentLocation}>
            내 위치 기준 보기
          </FormButton>
          <FormButton htmlType="button" variant="secondary" onClick={onShowAllCustomers}>
            전체 고객 보기
          </FormButton>
        </div>
        <div className="customers-map-page__toolbar-row customers-map-page__radius">
          <span className="customers-map-page__radius-label">반경</span>
          {CUSTOMER_MAP_RADIUS_OPTIONS_KM.map((km) => (
            <FormButton
              key={km}
              htmlType="button"
              variant={radiusKm === km ? 'primary' : 'secondary'}
              className={radiusKm === km ? 'customers-map-page__radius-btn--active' : undefined}
              onClick={() => onRadiusChange(km)}
            >
              {km}km
            </FormButton>
          ))}
          <FormButton
            htmlType="button"
            variant={radiusKm == null ? 'primary' : 'secondary'}
            onClick={() => onRadiusChange(null)}
          >
            제한 없음
          </FormButton>
        </div>
        <div className="customers-map-page__toolbar-row">
          <label className="customers-map-page__favorite-only">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(e) => onFavoriteOnlyChange(e.target.checked)}
            />
            즐겨찾기만
          </label>
          <FormInput
            type="search"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="이름·연락처·주소 검색"
            className="customers-map-page__keyword"
          />
        </div>
      </div>

      {error ? <p className="customers-map-page__error">{error}</p> : null}
      {loading ? <p className="customers-map-page__loading">고객 위치를 불러오는 중…</p> : null}

      <div className="customers-map-page__map-wrap">
        <MapProviderLoader>
          {({ provider, clientKey, ready, error: sdkError }) => {
            if (ready && provider !== 'none' && clientKey) {
              return (
                <>
                  <CustomerMapCanvas
                    provider={provider}
                    clientKey={clientKey}
                    customers={mapCustomers}
                    centerLat={viewportCenterLat}
                    centerLng={viewportCenterLng}
                    zoom={viewportZoom}
                    selectedCustomerId={selectedCustomerId}
                    onViewportChange={onViewportChange}
                    onSelectCustomer={onSelectCustomer}
                  />
                  {selectedCustomer ? (
                    <CustomerMapMarkerCard
                      customer={selectedCustomer}
                      onClose={() => onSelectCustomer(null)}
                      onOpenDetail={onOpenCustomerDetail}
                    />
                  ) : null}
                </>
              )
            }

            if (!hasMarkers) {
              return (
                <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
                  <p className="customer-map-setup-notice__body">
                    표시할 고객 좌표가 없습니다. 주소 backfill 후 다시 확인해 주세요.
                  </p>
                </div>
              )
            }

            if (sdkError && staticMap?.configured) {
              return (
                <>
                  <p className="customers-map-page__fallback-note" role="status">
                    {sdkError}
                  </p>
                  <CustomerStaticMapImage
                    token={token}
                    query={mapQuery}
                    configured={staticMap.configured}
                    hasMarkers={hasMarkers}
                  />
                </>
              )
            }

            return (
              <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
                <p className="customer-map-setup-notice__title">지도 설정이 필요합니다</p>
                <p className="customer-map-setup-notice__body">
                  VITE_NAVER_MAP_CLIENT_ID와 서버 NAVER_MAPS 설정을 확인해 주세요.
                </p>
              </div>
            )
          }}
        </MapProviderLoader>
      </div>

      <CustomerMapCustomerList
        customers={mapCustomers}
        selectedCustomerId={selectedCustomerId}
        onOpenDetail={onOpenCustomerDetail}
        onSelectCustomer={onSelectCustomer}
      />
    </main>
  )
}
