import { FormButton, FormInput } from '../../../../components/form'
import CustomerMapCanvas from '../../components/map/CustomerMapCanvas'
import CustomerMapMarkerCard from '../../components/map/CustomerMapMarkerCard'
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
  customers,
  stats,
  centerLat,
  centerLng,
  zoom,
  radiusKm,
  selectedCustomer,
  favoriteOnly,
  keyword,
  onRadiusChange,
  onShowAllCustomers,
  onCurrentLocation,
  onSelectCustomer,
  onMapCenterChange,
  onOpenCustomerDetail,
  onFavoriteOnlyChange,
  onKeywordChange,
}: CustomerMapShellProps) {
  const modifier = variant === 'pc' ? 'customers-map-page--pc' : 'customers-map-page--mobile'

  return (
    <main className={`page customers-map-page ${modifier} page--with-back`}>
      <header className="customers-map-page__header">
        <h1 className="customers-map-page__title">고객 지도</h1>
        {stats ? (
          <p className="customers-map-page__stats">
            좌표 있음 {stats.withLocation}명 · 주소 없음 {stats.missingAddress}명 · 변환 실패{' '}
            {stats.geocodeFailed}명
          </p>
        ) : null}
      </header>

      <div className="customers-map-page__toolbar">
        <div className="customers-map-page__toolbar-row">
          <FormButton htmlType="button" variant="secondary" onClick={onCurrentLocation}>
            현재 위치
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
          {({ provider, clientKey, ready }) =>
            ready ? (
              <CustomerMapCanvas
                provider={provider}
                clientKey={clientKey}
                customers={customers}
                centerLat={centerLat}
                centerLng={centerLng}
                zoom={zoom}
                selectedCustomerId={selectedCustomer?.id ?? null}
                onCenterChange={onMapCenterChange}
                onSelectCustomer={onSelectCustomer}
              />
            ) : (
              <div className="customer-map-setup-notice customer-map-setup-notice--inline">
                지도를 준비하는 중…
              </div>
            )
          }
        </MapProviderLoader>

        {selectedCustomer ? (
          <CustomerMapMarkerCard
            customer={selectedCustomer}
            onClose={() => onSelectCustomer(null)}
            onOpenDetail={onOpenCustomerDetail}
          />
        ) : null}
      </div>
    </main>
  )
}
