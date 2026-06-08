import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { FormButton, FormInput } from '../../../../components/form'
import CustomerMapCanvas from '../../components/map/CustomerMapCanvas'
import CustomerMapMarkerCard from '../../components/map/CustomerMapMarkerCard'
import CustomerStaticMapImage from '../../components/map/CustomerStaticMapImage'
import MapProviderLoader from '../../components/map/MapProviderLoader'
import { mapSdkErrorMessage } from '../../components/map/mapSdkErrors'
import { wasNaverMapAuthFailure } from '../../components/map/mapSdkLoader'
import {
  CUSTOMER_MAP_MAX_RADIUS_KM,
  CUSTOMER_MAP_RADIUS_OPTIONS_KM,
} from '../../config/customerMap.config'
import type { CustomerMapStats } from '../../api/customerMapApi'
import type { CustomerMapViewProps } from '../../hooks/useCustomerMapState'
import './customer-map-page.css'

type CustomerMapShellProps = CustomerMapViewProps & {
  variant: 'pc' | 'mobile'
}

function formatCustomerMapStats(stats: CustomerMapStats): string {
  const visible = stats.visibleInBounds ?? stats.displayedOnMap
  const parts = [
    `전체 ${stats.totalCustomers}명`,
    `좌표 완료 ${stats.geocodedSuccess}명`,
    `현재 화면 ${visible}명 중 ${stats.displayedOnMap}명 표시`,
    `주소 없음 ${stats.withoutAddress}명`,
    `실패 ${stats.geocodeFailed}명`,
  ]
  if (stats.geocodePending > 0) {
    parts.splice(3, 0, `변환 대기 ${stats.geocodePending}명`)
  }
  return parts.join(' · ')
}

export default function CustomerMapShell({
  variant,
  loading,
  boundsLoading,
  error,
  mapCustomers,
  staticMap,
  stats,
  mapQuery,
  mapAutoFitKey,
  radiusKm,
  favoriteOnly,
  keyword,
  viewportCenterLat,
  viewportCenterLng,
  viewportZoom,
  selectedCustomerId,
  selectedCustomer,
  onRadiusChange,
  onCurrentLocation,
  onOpenCustomerDetail,
  onFavoriteOnlyChange,
  onKeywordChange,
  onSelectCustomer,
  onViewportChange,
  onBoundsIdle,
}: CustomerMapShellProps) {
  const { token } = useAuth()
  const modifier = variant === 'pc' ? 'customers-map-page--pc' : 'customers-map-page--mobile'
  const hasMarkers = mapCustomers.length > 0
  const [mapInitFailed, setMapInitFailed] = useState(false)
  const [radiusInput, setRadiusInput] = useState(radiusKm == null ? '' : String(radiusKm))

  useEffect(() => {
    setRadiusInput(radiusKm == null ? '' : String(radiusKm))
  }, [radiusKm])

  const handleMapInitFailed = useCallback(() => {
    setMapInitFailed(true)
  }, [])

  const applyRadiusInput = useCallback(() => {
    const trimmed = radiusInput.trim()
    if (!trimmed) {
      onRadiusChange(null)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRadiusInput(radiusKm == null ? '' : String(radiusKm))
      return
    }
    const capped = Math.min(parsed, CUSTOMER_MAP_MAX_RADIUS_KM)
    onRadiusChange(capped)
    if (capped !== parsed) {
      setRadiusInput(String(capped))
    }
  }, [radiusInput, radiusKm, onRadiusChange])

  const handleRadiusInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        applyRadiusInput()
      }
    },
    [applyRadiusInput],
  )

  return (
    <main className={`page customers-map-page ${modifier} page--with-back`}>
      <header className="customers-map-page__header">
        <h1 className="customers-map-page__title">고객 지도</h1>
        <p className="customers-map-page__notice">
          좌표 변환이 완료된 고객만 지도에 표시됩니다.
        </p>
        {stats ? (
          <p className="customers-map-page__stats">{formatCustomerMapStats(stats)}</p>
        ) : null}
        {stats && stats.hiddenByLimit > 0 ? (
          <p className="customers-map-page__limit-notice" role="status">
            현재 화면에 고객이 많아 {stats.displayedOnMap}명만 표시 중입니다. (
            {stats.hiddenByLimit}명 숨김) 지도를 확대해 주세요.
          </p>
        ) : null}
      </header>

      <div className="customers-map-page__toolbar">
        <div className="customers-map-page__toolbar-row customers-map-page__toolbar-row--primary">
          <FormButton htmlType="button" variant="secondary" onClick={onCurrentLocation}>
            내 위치 기준 보기
          </FormButton>
          <div className="customers-map-page__radius-group">
            <span className="customers-map-page__radius-label">반경</span>
            <FormInput
              type="number"
              min={1}
              max={CUSTOMER_MAP_MAX_RADIUS_KM}
              step={1}
              inputMode="decimal"
              value={radiusInput}
              onChange={(e) => setRadiusInput(e.target.value)}
              onBlur={applyRadiusInput}
              onKeyDown={handleRadiusInputKeyDown}
              className="customers-map-page__radius-input"
              aria-label="반경 km"
            />
            <span className="customers-map-page__radius-unit">km</span>
            {CUSTOMER_MAP_RADIUS_OPTIONS_KM.map((km) => (
              <FormButton
                key={km}
                htmlType="button"
                variant={radiusKm === km ? 'primary' : 'secondary'}
                className={
                  radiusKm === km ? 'customers-map-page__radius-btn--active' : undefined
                }
                onClick={() => onRadiusChange(km)}
              >
                {km}
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
      {!loading && boundsLoading ? (
        <p className="customers-map-page__loading customers-map-page__bounds-loading" role="status">
          현재 화면 고객을 불러오는 중…
        </p>
      ) : null}

      <div className="customers-map-page__map-wrap">
        <MapProviderLoader>
          {({ provider, clientKey, ready, error: sdkError, errorCode }) => {
            const useStaticFallback =
              mapInitFailed ||
              Boolean(sdkError && errorCode !== 'missing_client_id' && staticMap?.configured)

            if (ready && provider !== 'none' && clientKey && !useStaticFallback) {
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
                    autoFitKey={mapAutoFitKey}
                    onViewportChange={onViewportChange}
                    onBoundsIdle={onBoundsIdle}
                    onSelectCustomer={onSelectCustomer}
                    onMapInitFailed={handleMapInitFailed}
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

            if (useStaticFallback) {
              const fallbackMessage =
                errorCode === 'naver_auth_failure' || wasNaverMapAuthFailure()
                  ? mapSdkErrorMessage('naver_auth_failure')
                  : mapInitFailed || errorCode === 'map_init_failed'
                    ? mapSdkErrorMessage('map_init_failed')
                    : sdkError ?? mapSdkErrorMessage('script_load_failed')
              return (
                <>
                  <p className="customers-map-page__fallback-note" role="status">
                    {fallbackMessage}
                  </p>
                  <CustomerStaticMapImage
                    token={token}
                    query={mapQuery}
                    configured={staticMap?.configured ?? false}
                    hasMarkers={hasMarkers}
                  />
                </>
              )
            }

            if (errorCode === 'missing_client_id' || sdkError) {
              return (
                <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
                  <p className="customer-map-setup-notice__title">지도 설정이 필요합니다</p>
                  <p className="customer-map-setup-notice__body">
                    {sdkError ?? mapSdkErrorMessage('missing_client_id')}
                  </p>
                </div>
              )
            }

            return (
              <p className="customers-map-page__loading" role="status">
                지도를 불러오는 중…
              </p>
            )
          }}
        </MapProviderLoader>
      </div>
    </main>
  )
}
