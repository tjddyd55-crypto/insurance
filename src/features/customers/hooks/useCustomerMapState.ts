import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchCustomerMap,
  type CustomerMapListItem,
  type CustomerMapMarker,
  type CustomerMapStaticMapMeta,
  type CustomerMapStats,
  type FetchCustomerMapParams,
} from '../api/customerMapApi'
import {
  CUSTOMER_MAP_DEFAULT_CENTER,
  CUSTOMER_MAP_RENDER_MODE,
  type CustomerMapPersistedState,
} from '../config/customerMap.config'

export type CustomerMapViewProps = {
  loading: boolean
  error: string | null
  customers: CustomerMapMarker[]
  mapCustomers: CustomerMapListItem[]
  staticMap: CustomerMapStaticMapMeta | null
  stats: CustomerMapStats | null
  mapQuery: FetchCustomerMapParams
  radiusKm: number | null
  favoriteOnly: boolean
  keyword: string
  onRadiusChange: (radiusKm: number | null) => void
  onShowAllCustomers: () => void
  onCurrentLocation: () => void
  onOpenCustomerDetail: (customerId: number) => void
  onFavoriteOnlyChange: (value: boolean) => void
  onKeywordChange: (value: string) => void
}

function parseRestoredState(locationState: unknown): CustomerMapPersistedState | null {
  if (!locationState || typeof locationState !== 'object') {
    return null
  }
  const root = locationState as { mapState?: unknown }
  const raw = root.mapState
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const s = raw as Partial<CustomerMapPersistedState>
  const centerLat = Number(s.centerLat)
  const centerLng = Number(s.centerLng)
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    return null
  }
  return {
    centerLat,
    centerLng,
    radiusKm: s.radiusKm == null ? null : Number(s.radiusKm),
    selectedCustomerId:
      s.selectedCustomerId == null ? null : Number(s.selectedCustomerId),
    filters: {
      favoriteOnly: Boolean(s.filters?.favoriteOnly),
      keyword: String(s.filters?.keyword ?? ''),
    },
    renderMode: CUSTOMER_MAP_RENDER_MODE,
    useExplicitCenter: Boolean(s.useExplicitCenter),
  }
}

export function useCustomerMapState(): CustomerMapViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const restored = useMemo(() => parseRestoredState(location.state), [location.state])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerMapMarker[]>([])
  const [mapCustomers, setMapCustomers] = useState<CustomerMapListItem[]>([])
  const [staticMap, setStaticMap] = useState<CustomerMapStaticMapMeta | null>(null)
  const [stats, setStats] = useState<CustomerMapStats | null>(null)
  const [centerLat, setCenterLat] = useState(
    restored?.centerLat ?? CUSTOMER_MAP_DEFAULT_CENTER.lat,
  )
  const [centerLng, setCenterLng] = useState(
    restored?.centerLng ?? CUSTOMER_MAP_DEFAULT_CENTER.lng,
  )
  const [radiusKm, setRadiusKm] = useState<number | null>(restored?.radiusKm ?? null)
  const [useExplicitCenter, setUseExplicitCenter] = useState(restored?.useExplicitCenter ?? false)
  const [favoriteOnly, setFavoriteOnly] = useState(restored?.filters.favoriteOnly ?? false)
  const [keyword, setKeyword] = useState(restored?.filters.keyword ?? '')
  const loadSeq = useRef(0)

  const mapQuery = useMemo<FetchCustomerMapParams>(
    () => ({
      centerLat: useExplicitCenter ? centerLat : undefined,
      centerLng: useExplicitCenter ? centerLng : undefined,
      radiusKm: useExplicitCenter ? radiusKm : null,
      useExplicitCenter,
      favoriteOnly,
      keyword,
    }),
    [centerLat, centerLng, radiusKm, useExplicitCenter, favoriteOnly, keyword],
  )

  const loadCustomers = useCallback(async () => {
    if (!token?.trim()) {
      setCustomers([])
      setMapCustomers([])
      setStaticMap(null)
      setStats(null)
      setLoading(false)
      return
    }
    const seq = loadSeq.current + 1
    loadSeq.current = seq
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCustomerMap(token, mapQuery)
      if (loadSeq.current !== seq) {
        return
      }
      setCustomers(res.customers)
      setMapCustomers(res.mapCustomers)
      setStaticMap(res.staticMap)
      setStats(res.stats)
    } catch (err) {
      if (loadSeq.current !== seq) {
        return
      }
      setError(err instanceof Error ? err.message : '고객 지도를 불러오지 못했습니다.')
    } finally {
      if (loadSeq.current === seq) {
        setLoading(false)
      }
    }
  }, [token, mapQuery])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const buildMapState = useCallback(
    (): CustomerMapPersistedState => ({
      centerLat,
      centerLng,
      radiusKm,
      selectedCustomerId: null,
      filters: { favoriteOnly, keyword },
      renderMode: CUSTOMER_MAP_RENDER_MODE,
      useExplicitCenter,
    }),
    [centerLat, centerLng, radiusKm, favoriteOnly, keyword, useExplicitCenter],
  )

  const onCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 사용할 수 없습니다.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenterLat(pos.coords.latitude)
        setCenterLng(pos.coords.longitude)
        setUseExplicitCenter(true)
        if (radiusKm == null) {
          setRadiusKm(3)
        }
        setError(null)
      },
      () => {
        setError('현재 위치 권한이 거부되었습니다. 전체 고객 기준으로 표시합니다.')
        setUseExplicitCenter(false)
        setRadiusKm(null)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [radiusKm])

  const onShowAllCustomers = useCallback(() => {
    setUseExplicitCenter(false)
    setRadiusKm(null)
    setError(null)
  }, [])

  const onOpenCustomerDetail = useCallback(
    (customerId: number) => {
      navigate(`/customers/${customerId}/consultations`, {
        state: {
          from: 'customer-map',
          mapState: {
            ...buildMapState(),
            selectedCustomerId: customerId,
          },
        },
      })
    },
    [navigate, buildMapState],
  )

  return {
    loading,
    error,
    customers,
    mapCustomers,
    staticMap,
    stats,
    mapQuery,
    radiusKm,
    favoriteOnly,
    keyword,
    onRadiusChange: (nextRadius) => {
      setRadiusKm(nextRadius)
      if (nextRadius != null && nextRadius > 0) {
        setUseExplicitCenter(true)
      }
    },
    onShowAllCustomers,
    onCurrentLocation,
    onOpenCustomerDetail,
    onFavoriteOnlyChange: setFavoriteOnly,
    onKeywordChange: setKeyword,
  }
}
