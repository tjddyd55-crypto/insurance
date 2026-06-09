import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchCustomerMap,
  type CustomerMapListItem,
  type CustomerMapMarker,
  type CustomerMapDynamicMapMeta,
  type CustomerMapStaticMapMeta,
  type CustomerMapStats,
  type CustomerMapViewportBounds,
  type FetchCustomerMapParams,
} from '../api/customerMapApi'
import {
  CUSTOMER_MAP_DEFAULT_CENTER,
  CUSTOMER_MAP_FOCUS_ZOOM,
  CUSTOMER_MAP_RENDER_MODE,
  type CustomerMapPersistedState,
} from '../config/customerMap.config'
import { openCustomerDetailFromMap } from '../utils/customerMapDetailNavigation'
import {
  CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE,
  FOCUS_CUSTOMER_ID_QUERY_KEY,
  FOCUS_ZOOM_QUERY_KEY,
  parseFocusCustomerId,
  parseFocusZoom,
} from '../utils/customerMapFocusNavigation'

const BOUNDS_DEBOUNCE_MS = 400
const BOUNDS_KEY_PRECISION = 4

export type CustomerMapViewProps = {
  loading: boolean
  boundsLoading: boolean
  error: string | null
  customers: CustomerMapMarker[]
  mapCustomers: CustomerMapListItem[]
  mapMeta: CustomerMapDynamicMapMeta | null
  staticMap: CustomerMapStaticMapMeta | null
  stats: CustomerMapStats | null
  mapQuery: FetchCustomerMapParams
  mapAutoFitKey: string
  radiusKm: number | null
  favoriteOnly: boolean
  keyword: string
  viewportCenterLat: number
  viewportCenterLng: number
  viewportZoom: number
  selectedCustomerId: number | null
  selectedCustomer: CustomerMapListItem | null
  focusNotice: string | null
  skipAutoFit: boolean
  onRadiusChange: (radiusKm: number | null) => void
  onCurrentLocation: () => void
  onOpenCustomerDetail: (customerId: number) => void
  onFavoriteOnlyChange: (value: boolean) => void
  onKeywordChange: (value: string) => void
  onSelectCustomer: (customerId: number | null) => void
  onViewportChange: (centerLat: number, centerLng: number, zoom: number) => void
  onBoundsIdle: (bounds: CustomerMapViewportBounds) => void
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
    zoom: s.zoom == null ? undefined : Number(s.zoom),
  }
}

function boundsToKey(bounds: CustomerMapViewportBounds): string {
  return [
    bounds.north,
    bounds.south,
    bounds.east,
    bounds.west,
    bounds.zoom,
  ]
    .map((value) => value.toFixed(BOUNDS_KEY_PRECISION))
    .join(',')
}

export function useCustomerMapState(): CustomerMapViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const restored = useMemo(() => parseRestoredState(location.state), [location.state])
  const pendingFocusCustomerIdRef = useRef<number | null>(
    restored ? null : parseFocusCustomerId(searchParams.get(FOCUS_CUSTOMER_ID_QUERY_KEY)),
  )
  const pendingFocusZoomRef = useRef<number | null>(
    parseFocusZoom(searchParams.get(FOCUS_ZOOM_QUERY_KEY)),
  )
  const focusHandledRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [boundsLoading, setBoundsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerMapMarker[]>([])
  const [mapCustomers, setMapCustomers] = useState<CustomerMapListItem[]>([])
  const [mapMeta, setMapMeta] = useState<CustomerMapDynamicMapMeta | null>(null)
  const [staticMap, setStaticMap] = useState<CustomerMapStaticMapMeta | null>(null)
  const [stats, setStats] = useState<CustomerMapStats | null>(null)
  const [centerLat, setCenterLat] = useState(
    restored?.centerLat ?? CUSTOMER_MAP_DEFAULT_CENTER.lat,
  )
  const [centerLng, setCenterLng] = useState(
    restored?.centerLng ?? CUSTOMER_MAP_DEFAULT_CENTER.lng,
  )
  const [viewportCenterLat, setViewportCenterLat] = useState(
    restored?.centerLat ?? CUSTOMER_MAP_DEFAULT_CENTER.lat,
  )
  const [viewportCenterLng, setViewportCenterLng] = useState(
    restored?.centerLng ?? CUSTOMER_MAP_DEFAULT_CENTER.lng,
  )
  const [viewportZoom, setViewportZoom] = useState(restored?.zoom ?? 12)
  const [radiusKm, setRadiusKm] = useState<number | null>(restored?.radiusKm ?? null)
  const [useExplicitCenter, setUseExplicitCenter] = useState(restored?.useExplicitCenter ?? false)
  const [favoriteOnly, setFavoriteOnly] = useState(restored?.filters.favoriteOnly ?? false)
  const [keyword, setKeyword] = useState(restored?.filters.keyword ?? '')
  const restoredSelectedId =
    restored?.selectedCustomerId != null && Number.isFinite(restored.selectedCustomerId)
      ? restored.selectedCustomerId
      : null
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(restoredSelectedId)
  const [focusNotice, setFocusNotice] = useState<string | null>(null)
  const [skipAutoFit, setSkipAutoFit] = useState(false)
  /** 지도 복귀 시 mapCustomers 로드 전 selectedCustomerId 가 null 로 지워지지 않도록 보관 */
  const pendingSelectedCustomerIdRef = useRef<number | null>(restoredSelectedId)
  const [mapBounds, setMapBounds] = useState<CustomerMapViewportBounds | null>(null)
  const loadSeq = useRef(0)
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBoundsKeyRef = useRef<string | null>(null)

  const mapAutoFitKey = useMemo(
    () =>
      [
        favoriteOnly ? '1' : '0',
        keyword.trim(),
        radiusKm == null ? 'none' : String(radiusKm),
        useExplicitCenter ? '1' : '0',
        centerLat.toFixed(5),
        centerLng.toFixed(5),
      ].join('|'),
    [favoriteOnly, keyword, radiusKm, useExplicitCenter, centerLat, centerLng],
  )

  const mapQuery = useMemo<FetchCustomerMapParams>(
    () => ({
      centerLat: useExplicitCenter ? centerLat : undefined,
      centerLng: useExplicitCenter ? centerLng : undefined,
      radiusKm: useExplicitCenter ? radiusKm : null,
      useExplicitCenter,
      favoriteOnly,
      keyword,
      ...(mapBounds
        ? {
            north: mapBounds.north,
            south: mapBounds.south,
            east: mapBounds.east,
            west: mapBounds.west,
            zoom: mapBounds.zoom,
          }
        : {}),
    }),
    [centerLat, centerLng, radiusKm, useExplicitCenter, favoriteOnly, keyword, mapBounds],
  )

  useEffect(() => {
    lastBoundsKeyRef.current = null
    setMapBounds(null)
  }, [favoriteOnly, keyword, radiusKm, useExplicitCenter, centerLat, centerLng])

  useEffect(() => {
    return () => {
      if (boundsDebounceRef.current) {
        clearTimeout(boundsDebounceRef.current)
      }
    }
  }, [])

  const loadCustomers = useCallback(async () => {
    if (!token?.trim()) {
      setCustomers([])
      setMapCustomers([])
      setMapMeta(null)
      setStaticMap(null)
      setStats(null)
      setLoading(false)
      setBoundsLoading(false)
      return
    }
    const seq = loadSeq.current + 1
    loadSeq.current = seq
    const isBoundsFetch = mapBounds != null
    if (isBoundsFetch) {
      setBoundsLoading(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await fetchCustomerMap(token, mapQuery)
      if (loadSeq.current !== seq) {
        return
      }
      setCustomers(res.customers)
      setMapCustomers(res.mapCustomers)
      setMapMeta(res.map)
      setStaticMap(res.staticMap)
      setStats(res.stats)
    } catch (err) {
      if (loadSeq.current !== seq) {
        return
      }
      setError(err instanceof Error ? err.message : '고객 지도를 불러오지 못했습니다.')
    } finally {
      if (loadSeq.current === seq) {
        if (isBoundsFetch) {
          setBoundsLoading(false)
        } else {
          setLoading(false)
        }
      }
    }
  }, [token, mapQuery, mapBounds])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const clearFocusQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    if (!next.has(FOCUS_CUSTOMER_ID_QUERY_KEY) && !next.has(FOCUS_ZOOM_QUERY_KEY)) {
      return
    }
    next.delete(FOCUS_CUSTOMER_ID_QUERY_KEY)
    next.delete(FOCUS_ZOOM_QUERY_KEY)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const focusId = pendingFocusCustomerIdRef.current
    if (focusId == null || focusHandledRef.current || restored) {
      return
    }
    if (loading) {
      return
    }

    const customer = mapCustomers.find((row) => row.id === focusId)
    if (!customer) {
      if (mapCustomers.length === 0 && stats == null) {
        return
      }
      focusHandledRef.current = true
      pendingFocusCustomerIdRef.current = null
      setFocusNotice(CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE)
      clearFocusQuery()
      return
    }

    const zoom = pendingFocusZoomRef.current ?? CUSTOMER_MAP_FOCUS_ZOOM
    focusHandledRef.current = true
    pendingFocusCustomerIdRef.current = null
    pendingFocusZoomRef.current = null
    pendingSelectedCustomerIdRef.current = null
    setFocusNotice(null)
    setSkipAutoFit(true)
    setUseExplicitCenter(false)
    setRadiusKm(null)
    setCenterLat(customer.latitude)
    setCenterLng(customer.longitude)
    setViewportCenterLat(customer.latitude)
    setViewportCenterLng(customer.longitude)
    setViewportZoom(zoom)
    setSelectedCustomerId(customer.id)
    clearFocusQuery()
  }, [loading, mapCustomers, stats, restored, clearFocusQuery])

  useEffect(() => {
    setSkipAutoFit(false)
  }, [favoriteOnly, keyword, radiusKm])

  useEffect(() => {
    const pending = pendingSelectedCustomerIdRef.current
    if (pending == null) {
      return
    }
    if (loading || boundsLoading) {
      return
    }
    if (mapBounds == null) {
      return
    }
    if (mapCustomers.some((c) => c.id === pending)) {
      setSelectedCustomerId(pending)
      pendingSelectedCustomerIdRef.current = null
      return
    }
    pendingSelectedCustomerIdRef.current = null
    setSelectedCustomerId(null)
  }, [mapCustomers, loading, boundsLoading, mapBounds])

  useEffect(() => {
    if (selectedCustomerId == null) {
      return
    }
    if (pendingSelectedCustomerIdRef.current != null) {
      return
    }
    if (loading || boundsLoading) {
      return
    }
    if (!mapCustomers.some((c) => c.id === selectedCustomerId)) {
      setSelectedCustomerId(null)
    }
  }, [mapCustomers, selectedCustomerId, loading, boundsLoading])

  const onSelectCustomer = useCallback((customerId: number | null) => {
    pendingSelectedCustomerIdRef.current = null
    setSelectedCustomerId(customerId)
  }, [])

  const buildMapState = useCallback(
    (): CustomerMapPersistedState => ({
      centerLat: viewportCenterLat,
      centerLng: viewportCenterLng,
      radiusKm,
      selectedCustomerId,
      filters: { favoriteOnly, keyword },
      renderMode: CUSTOMER_MAP_RENDER_MODE,
      useExplicitCenter,
      zoom: viewportZoom,
    }),
    [
      viewportCenterLat,
      viewportCenterLng,
      radiusKm,
      selectedCustomerId,
      favoriteOnly,
      keyword,
      useExplicitCenter,
      viewportZoom,
    ],
  )

  const onCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 사용할 수 없습니다.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCenterLat(lat)
        setCenterLng(lng)
        setViewportCenterLat(lat)
        setViewportCenterLng(lng)
        setUseExplicitCenter(true)
        if (radiusKm == null) {
          setRadiusKm(3)
        }
        setError(null)
      },
      () => {
        setError('현재 위치 권한이 거부되었습니다.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [radiusKm])

  const onOpenCustomerDetail = useCallback(
    (customerId: number) => {
      const customer = mapCustomers.find((row) => row.id === customerId)
      openCustomerDetailFromMap({
        customerId,
        customerName: customer?.name,
        isMobile,
        mapState: buildMapState(),
        navigate,
      })
    },
    [mapCustomers, isMobile, buildMapState, navigate],
  )

  const onBoundsIdle = useCallback((bounds: CustomerMapViewportBounds) => {
    const key = boundsToKey(bounds)
    if (key === lastBoundsKeyRef.current) {
      return
    }
    lastBoundsKeyRef.current = key
    if (boundsDebounceRef.current) {
      clearTimeout(boundsDebounceRef.current)
    }
    boundsDebounceRef.current = setTimeout(() => {
      setMapBounds(bounds)
    }, BOUNDS_DEBOUNCE_MS)
  }, [])

  const selectedCustomer = useMemo(
    () => mapCustomers.find((row) => row.id === selectedCustomerId) ?? null,
    [mapCustomers, selectedCustomerId],
  )

  return {
    loading,
    boundsLoading,
    error,
    customers,
    mapCustomers,
    mapMeta,
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
    focusNotice,
    skipAutoFit,
    onRadiusChange: (nextRadius) => {
      setRadiusKm(nextRadius)
      if (nextRadius != null && nextRadius > 0) {
        setUseExplicitCenter(true)
      } else {
        setUseExplicitCenter(false)
      }
    },
    onCurrentLocation,
    onOpenCustomerDetail,
    onFavoriteOnlyChange: setFavoriteOnly,
    onKeywordChange: setKeyword,
    onSelectCustomer,
    onViewportChange: (lat, lng, zoom) => {
      setViewportCenterLat(lat)
      setViewportCenterLng(lng)
      setViewportZoom(zoom)
    },
    onBoundsIdle,
  }
}
