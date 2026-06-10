import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { FormButton, FormInput } from '../../../../components/form'
import CustomerMapCanvas from '../../components/map/CustomerMapCanvas'
import CustomerMapMarkerCard from '../../components/map/CustomerMapMarkerCard'
import CustomerMapUnmappedList from '../../components/map/CustomerMapUnmappedList'
import CustomerStaticMapImage from '../../components/map/CustomerStaticMapImage'
import MapProviderLoader from '../../components/map/MapProviderLoader'
import { mapSdkErrorMessage } from '../../components/map/mapSdkErrors'
import { wasNaverMapAuthFailure } from '../../components/map/mapSdkLoader'
import {
  CUSTOMER_MAP_MAX_RADIUS_KM,
  CUSTOMER_MAP_RADIUS_OPTIONS_KM,
} from '../../config/customerMap.config'
import type { CustomerMapViewProps } from '../../hooks/useCustomerMapState'
import './customer-map-page.css'

type CustomerMapShellProps = CustomerMapViewProps & {
  variant: 'pc' | 'mobile'
}

export default function CustomerMapShell({
  variant,
  loading,
  boundsLoading,
  error,
  mapCustomers,
  unmappedCustomers,
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
  selectedGroupKey,
  selectedMarkerGroup,
  showUnmappedList,
  focusNotice,
  skipAutoFit,
  onRadiusChange,
  onCurrentLocation,
  onOpenCustomerDetail,
  onFavoriteOnlyChange,
  onKeywordChange,
  onSelectMarkerGroup,
  onHighlightCustomer,
  onCloseMarkerCard,
  onToggleUnmappedList,
  onViewportChange,
  onBoundsIdle,
}: CustomerMapShellProps) {
  const { token } = useAuth()
  const modifier = variant === 'pc' ? 'customers-map-page--pc' : 'customers-map-page--mobile'
  const hasMarkers = mapCustomers.length > 0
  const mappedCount = stats?.mappedCount ?? stats?.geocodedSuccess ?? 0
  const unmappedCount = stats?.unmappedCount ?? unmappedCustomers.length
  const pageClassName = [
    'page',
    'customers-map-page',
    modifier,
    'page--with-back',
    showUnmappedList ? 'customers-map-page--unmapped-open' : '',
  ]
    .filter(Boolean)
    .join(' ')
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
    <main className={pageClassName}>
      <header className="customers-map-page__header">
        <h1 className="customers-map-page__title">고객 지도</h1>
        {stats ? (
          <div className="customers-map-page__header-summary">
            <p className="customers-map-page__summary">
              지도 표시 고객 {mappedCount}명 · 지도 미표시 {unmappedCount}명
            </p>
            <FormButton
              htmlType="button"
              type="button"
              variant={showUnmappedList ? 'primary' : 'secondary'}
              onClick={onToggleUnmappedList}
            >
              {showUnmappedList ? '지도 미표시 고객 닫기' : '지도 미표시 고객 보기'}
            </FormButton>
          </div>
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

      {focusNotice ? (
        <p className="customers-map-page__focus-notice" role="status">
          {focusNotice}
        </p>
      ) : null}
      {error ? <p className="customers-map-page__error">{error}</p> : null}
      {loading ? <p className="customers-map-page__loading">고객 위치를 불러오는 중…</p> : null}
      {!loading && boundsLoading ? (
        <p className="customers-map-page__loading customers-map-page__bounds-loading" role="status">
          현재 화면 고객을 불러오는 중…
        </p>
      ) : null}

      {showUnmappedList ? (
        <section className="customers-map-page__unmapped-panel" aria-label="지도 미표시 고객">
          <div className="customers-map-page__unmapped-panel-head">
            <div>
              <h2 className="customers-map-page__unmapped-title">지도 미표시 고객</h2>
              <p className="customers-map-page__unmapped-desc">
                주소가 없거나 좌표 변환이 완료되지 않아 지도에 표시되지 않는 고객입니다.
              </p>
            </div>
            <FormButton
              htmlType="button"
              type="button"
              variant="secondary"
              className="customers-map-page__unmapped-close"
              onClick={onToggleUnmappedList}
            >
              닫기
            </FormButton>
          </div>
          <CustomerMapUnmappedList
            customers={unmappedCustomers}
            onOpenDetail={onOpenCustomerDetail}
          />
        </section>
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
                    selectedGroupKey={selectedGroupKey}
                    autoFitKey={mapAutoFitKey}
                    skipAutoFit={skipAutoFit}
                    onViewportChange={onViewportChange}
                    onBoundsIdle={onBoundsIdle}
                    onSelectMarkerGroup={onSelectMarkerGroup}
                    onMapInitFailed={handleMapInitFailed}
                  />
                  {selectedMarkerGroup ? (
                    <CustomerMapMarkerCard
                      group={selectedMarkerGroup}
                      highlightedCustomerId={selectedCustomerId}
                      onClose={onCloseMarkerCard}
                      onOpenDetail={onOpenCustomerDetail}
                      onHighlightCustomer={onHighlightCustomer}
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
