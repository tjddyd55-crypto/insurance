import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchCustomerMap,
  type CustomerMapMarker,
  type CustomerMapStats,
} from '../api/customerMapApi'
import {
  CUSTOMER_MAP_DEFAULT_CENTER,
  CUSTOMER_MAP_DEFAULT_ZOOM,
  type CustomerMapPersistedState,
} from '../config/customerMap.config'

export type CustomerMapViewProps = {
  loading: boolean
  error: string | null
  customers: CustomerMapMarker[]
  stats: CustomerMapStats | null
  centerLat: number
  centerLng: number
  zoom: number
  radiusKm: number | null
  selectedCustomer: CustomerMapMarker | null
  favoriteOnly: boolean
  keyword: string
  onRadiusChange: (radiusKm: number | null) => void
  onShowAllCustomers: () => void
  onCurrentLocation: () => void
  onSelectCustomer: (customer: CustomerMapMarker | null) => void
  onMapCenterChange: (centerLat: number, centerLng: number, zoom: number) => void
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
  const zoom = Number(s.zoom)
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(zoom)) {
    return null
  }
  return {
    centerLat,
    centerLng,
    zoom,
    radiusKm: s.radiusKm == null ? null : Number(s.radiusKm),
    selectedCustomerId:
      s.selectedCustomerId == null ? null : Number(s.selectedCustomerId),
    filters: {
      favoriteOnly: Boolean(s.filters?.favoriteOnly),
      keyword: String(s.filters?.keyword ?? ''),
    },
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
  const [stats, setStats] = useState<CustomerMapStats | null>(null)
  const [centerLat, setCenterLat] = useState(
    restored?.centerLat ?? CUSTOMER_MAP_DEFAULT_CENTER.lat,
  )
  const [centerLng, setCenterLng] = useState(
    restored?.centerLng ?? CUSTOMER_MAP_DEFAULT_CENTER.lng,
  )
  const [zoom, setZoom] = useState(restored?.zoom ?? CUSTOMER_MAP_DEFAULT_ZOOM)
  const [radiusKm, setRadiusKm] = useState<number | null>(restored?.radiusKm ?? null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    restored?.selectedCustomerId ?? null,
  )
  const [favoriteOnly, setFavoriteOnly] = useState(restored?.filters.favoriteOnly ?? false)
  const [keyword, setKeyword] = useState(restored?.filters.keyword ?? '')
  const loadSeq = useRef(0)

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  )

  const loadCustomers = useCallback(async () => {
    if (!token?.trim()) {
      setCustomers([])
      setStats(null)
      setLoading(false)
      return
    }
    const seq = loadSeq.current + 1
    loadSeq.current = seq
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCustomerMap(token, {
        centerLat: radiusKm != null ? centerLat : undefined,
        centerLng: radiusKm != null ? centerLng : undefined,
        radiusKm,
        favoriteOnly,
        keyword,
      })
      if (loadSeq.current !== seq) {
        return
      }
      setCustomers(res.customers)
      setStats(res.stats)
      if (
        selectedCustomerId != null &&
        !res.customers.some((c) => c.id === selectedCustomerId)
      ) {
        setSelectedCustomerId(null)
      }
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
  }, [token, centerLat, centerLng, radiusKm, favoriteOnly, keyword, selectedCustomerId])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const buildMapState = useCallback(
    (): CustomerMapPersistedState => ({
      centerLat,
      centerLng,
      zoom,
      radiusKm,
      selectedCustomerId,
      filters: { favoriteOnly, keyword },
    }),
    [centerLat, centerLng, zoom, radiusKm, selectedCustomerId, favoriteOnly, keyword],
  )

  const onMapCenterChange = useCallback((lat: number, lng: number, nextZoom: number) => {
    setCenterLat(lat)
    setCenterLng(lng)
    setZoom(nextZoom)
  }, [])

  const onCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 사용할 수 없습니다.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenterLat(pos.coords.latitude)
        setCenterLng(pos.coords.longitude)
        setZoom(14)
        setError(null)
      },
      () => {
        setError('현재 위치 권한이 거부되었습니다. 전체 고객 기준으로 표시합니다.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  const onShowAllCustomers = useCallback(() => {
    setRadiusKm(null)
    if (customers.length > 0) {
      const lats = customers.map((c) => c.latitude)
      const lngs = customers.map((c) => c.longitude)
      setCenterLat((Math.min(...lats) + Math.max(...lats)) / 2)
      setCenterLng((Math.min(...lngs) + Math.max(...lngs)) / 2)
      setZoom(11)
    }
  }, [customers])

  const onOpenCustomerDetail = useCallback(
    (customerId: number) => {
      navigate(`/customers/${customerId}/consultations`, {
        state: {
          from: 'customer-map',
          mapState: buildMapState(),
        },
      })
    },
    [navigate, buildMapState],
  )

  return {
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
    onRadiusChange: setRadiusKm,
    onShowAllCustomers,
    onCurrentLocation,
    onSelectCustomer: (customer) => setSelectedCustomerId(customer?.id ?? null),
    onMapCenterChange,
    onOpenCustomerDetail,
    onFavoriteOnlyChange: setFavoriteOnly,
    onKeywordChange: setKeyword,
  }
}
