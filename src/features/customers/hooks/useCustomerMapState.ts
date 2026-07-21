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
  type CustomerMapUnmappedItem,
  type CustomerMapViewportBounds,
  type FetchCustomerMapParams,
} from '../api/customerMapApi'
import {
  buildCoordinateGroupKey,
  findMarkerGroupByCustomerId,
  groupMapCustomersByCoordinate,
  type CustomerMapMarkerGroup,
} from '../utils/customerMapMarkerGroups'
import {
  findMapCustomerById,
  isValidMapCustomerPosition,
  sameCustomerMapId,
} from '../utils/customerMapCustomerId'
import {
  clearCustomerMapSelection,
  shouldOpenMarkerCardOnRecenter,
} from '../utils/customerMapSelection'
import {
  CUSTOMER_MAP_DEFAULT_CENTER,
  CUSTOMER_MAP_FOCUS_ZOOM,
  CUSTOMER_MAP_RENDER_MODE,
  type CustomerMapPersistedState,
} from '../config/customerMap.config'
import { openCustomerDetailFromMap } from '../utils/customerMapDetailNavigation'
import {
  buildCustomerDetailMapPath,
  CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE,
  FOCUS_CUSTOMER_ID_QUERY_KEY,
  FOCUS_ZOOM_QUERY_KEY,
  parseFocusCustomerId,
  parseFocusZoom,
} from '../utils/customerMapFocusNavigation'

const BOUNDS_DEBOUNCE_MS = 400
const BOUNDS_KEY_PRECISION = 4

export type UseCustomerMapStateOptions = {
  /**
   * 고객 상세 `/customers/:id/map` 진입 시 path 의 고객 id.
   * 메뉴 지도의 `?focusCustomerId=` 와 동일하게 초기 center/강조 처리.
   */
  initialFocusCustomerId?: number | null
  /**
   * true: 마커「상세」가 `/customers/:id/map` 으로 workspace 유지.
   * false(기본): 메뉴 지도의 openCustomerDetailFromMap.
   */
  openDetailInWorkspaceMap?: boolean
  /** focus 고객 좌표 없을 때 안내 (상세 탭용 문구 등) */
  focusUnavailableMessage?: string
}

export type CustomerMapViewProps = {
  loading: boolean
  boundsLoading: boolean
  error: string | null
  customers: CustomerMapMarker[]
  mapCustomers: CustomerMapListItem[]
  markerGroups: CustomerMapMarkerGroup[]
  unmappedCustomers: CustomerMapUnmappedItem[]
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
  selectedGroupKey: string | null
  selectedMarkerGroup: CustomerMapMarkerGroup | null
  showUnmappedList: boolean
  focusNotice: string | null
  skipAutoFit: boolean
  onRadiusChange: (radiusKm: number | null) => void
  onOpenCustomerDetail: (customerId: number) => void
  onFavoriteOnlyChange: (value: boolean) => void
  onKeywordChange: (value: string) => void
  onSelectMarkerGroup: (groupKey: string, customerId?: number | null) => void
  onHighlightCustomer: (customerId: number) => void
  onCloseMarkerCard: () => void
  onToggleUnmappedList: () => void
  onViewportChange: (centerLat: number, centerLng: number, zoom: number) => void
  onBoundsIdle: (bounds: CustomerMapViewportBounds) => void
  /** canvas 가 동일 좌표라도 center 재적용하도록 증가 */
  mapCenterApplyKey: number
  /** 선택 고객 좌표로 pan/zoom (데이터 재조회·remount 없음) */
  onRecenterToSelectedCustomer: () => void
  canRecenterToSelectedCustomer: boolean
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

export function useCustomerMapState(options: UseCustomerMapStateOptions = {}): CustomerMapViewProps {
  const {
    initialFocusCustomerId = null,
    openDetailInWorkspaceMap = false,
    focusUnavailableMessage = CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE,
  } = options
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const restored = useMemo(() => parseRestoredState(location.state), [location.state])
  const pendingFocusCustomerIdRef = useRef<number | null>(
    restored
      ? null
      : initialFocusCustomerId != null && initialFocusCustomerId > 0
        ? initialFocusCustomerId
        : parseFocusCustomerId(searchParams.get(FOCUS_CUSTOMER_ID_QUERY_KEY)),
  )
  const pendingFocusZoomRef = useRef<number | null>(
    parseFocusZoom(searchParams.get(FOCUS_ZOOM_QUERY_KEY)) ??
      (initialFocusCustomerId != null && initialFocusCustomerId > 0 ? CUSTOMER_MAP_FOCUS_ZOOM : null),
  )
  const focusHandledRef = useRef(false)
  /** 사용자가 마커 카드를 닫으면 true — path 고객 rehydrate 로 다시 열지 않음 */
  const userDismissedMarkerCardRef = useRef(false)
  const focusUnavailableMessageRef = useRef(focusUnavailableMessage)
  focusUnavailableMessageRef.current = focusUnavailableMessage

  const [loading, setLoading] = useState(true)
  const [boundsLoading, setBoundsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerMapMarker[]>([])
  const [mapCustomers, setMapCustomers] = useState<CustomerMapListItem[]>([])
  const [unmappedCustomers, setUnmappedCustomers] = useState<CustomerMapUnmappedItem[]>([])
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
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [showUnmappedList, setShowUnmappedList] = useState(false)
  const [focusNotice, setFocusNotice] = useState<string | null>(null)
  const [skipAutoFit, setSkipAutoFit] = useState(false)
  const [mapCenterApplyKey, setMapCenterApplyKey] = useState(0)
  /** 지도 복귀 시 mapCustomers 로드 전 selectedCustomerId 가 null 로 지워지지 않도록 보관 */
  const pendingSelectedCustomerIdRef = useRef<number | null>(restoredSelectedId)
  const [mapBounds, setMapBounds] = useState<CustomerMapViewportBounds | null>(null)
  const loadSeq = useRef(0)
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBoundsKeyRef = useRef<string | null>(null)

  /** path customerId 변경 시 focus 재적용 (Outlet remount 없을 때 대비) */
  useEffect(() => {
    if (initialFocusCustomerId == null || initialFocusCustomerId <= 0) {
      return
    }
    pendingFocusCustomerIdRef.current = initialFocusCustomerId
    pendingFocusZoomRef.current = CUSTOMER_MAP_FOCUS_ZOOM
    focusHandledRef.current = false
    userDismissedMarkerCardRef.current = false
  }, [initialFocusCustomerId])

  const markerGroups = useMemo(
    () => groupMapCustomersByCoordinate(mapCustomers),
    [mapCustomers],
  )

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
      setUnmappedCustomers([])
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
      setUnmappedCustomers(res.unmappedCustomers ?? [])
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

  /**
   * focusCustomerId /「고객 위치로 이동」공통 — 메뉴 지도 focus 와 동일 center·zoom·강조.
   * 목록 재조회·지도 remount 없음.
   * openMarkerCard=false 이면 pan/zoom 만 (닫은 카드 강제 재오픈 금지).
   */
  const applyCustomerFocus = useCallback(
    (
      customerId: number,
      zoomOverride?: number | null,
      options?: { openMarkerCard?: boolean },
    ): boolean => {
      const customer = findMapCustomerById(mapCustomers, customerId)
      if (!customer || !isValidMapCustomerPosition(customer)) {
        setFocusNotice(focusUnavailableMessageRef.current)
        return false
      }
      const zoom = zoomOverride ?? CUSTOMER_MAP_FOCUS_ZOOM
      const openMarkerCard = options?.openMarkerCard !== false
      setFocusNotice(null)
      setSkipAutoFit(true)
      setUseExplicitCenter(false)
      setRadiusKm(null)
      const group = findMarkerGroupByCustomerId(markerGroups, customer.id)
      const nextLat = group?.lat ?? customer.latitude
      const nextLng = group?.lng ?? customer.longitude
      setCenterLat(nextLat)
      setCenterLng(nextLng)
      setViewportCenterLat(nextLat)
      setViewportCenterLng(nextLng)
      setViewportZoom(zoom)
      if (openMarkerCard) {
        userDismissedMarkerCardRef.current = false
        setSelectedGroupKey(
          group?.groupKey ?? buildCoordinateGroupKey(customer.latitude, customer.longitude),
        )
        setSelectedCustomerId(Number(customer.id))
      }
      setMapCenterApplyKey((key) => key + 1)
      return true
    },
    [mapCustomers, markerGroups],
  )

  useEffect(() => {
    const focusId = pendingFocusCustomerIdRef.current
    if (focusId == null || focusHandledRef.current || restored) {
      return
    }
    if (loading) {
      return
    }

    const customer = findMapCustomerById(mapCustomers, focusId)
    if (!customer || !isValidMapCustomerPosition(customer)) {
      if (mapCustomers.length === 0 && stats == null) {
        return
      }
      /** 상세 탭: bounds 로드 후 나타날 수 있으므로 초기 목록에 없어도 포기하지 않음 */
      if (openDetailInWorkspaceMap && initialFocusCustomerId != null) {
        return
      }
      focusHandledRef.current = true
      pendingFocusCustomerIdRef.current = null
      setFocusNotice(focusUnavailableMessageRef.current)
      clearFocusQuery()
      return
    }

    const zoom = pendingFocusZoomRef.current ?? CUSTOMER_MAP_FOCUS_ZOOM
    focusHandledRef.current = true
    pendingFocusCustomerIdRef.current = null
    pendingFocusZoomRef.current = null
    pendingSelectedCustomerIdRef.current = null
    applyCustomerFocus(customer.id, zoom)
    clearFocusQuery()
  }, [
    loading,
    mapCustomers,
    stats,
    restored,
    clearFocusQuery,
    applyCustomerFocus,
    openDetailInWorkspaceMap,
    initialFocusCustomerId,
  ])

  /**
   * recenter 대상: 지도에서 고른 고객 → 없으면 path 의 상세 고객.
   * 활성 여부는 mapCustomers 마커 좌표 SSOT (상세 API lat/lng 단독 판단 금지).
   */
  const recenterTargetId = selectedCustomerId ?? initialFocusCustomerId ?? null
  const recenterTargetMarker = useMemo(
    () => findMapCustomerById(mapCustomers, recenterTargetId),
    [mapCustomers, recenterTargetId],
  )
  const canRecenterToSelectedCustomer = useMemo(
    () => isValidMapCustomerPosition(recenterTargetMarker),
    [recenterTargetMarker],
  )

  const onRecenterToSelectedCustomer = useCallback(() => {
    if (loading && mapCustomers.length === 0) {
      setFocusNotice('고객 위치를 불러오는 중입니다.')
      return
    }
    const targetId = selectedCustomerId ?? initialFocusCustomerId
    if (targetId == null) {
      setFocusNotice('선택한 고객의 위치 정보가 없습니다.')
      return
    }
    const marker = findMapCustomerById(mapCustomers, targetId)
    if (!marker || !isValidMapCustomerPosition(marker)) {
      setFocusNotice(focusUnavailableMessageRef.current)
      return
    }
    applyCustomerFocus(Number(marker.id), CUSTOMER_MAP_FOCUS_ZOOM, {
      openMarkerCard: shouldOpenMarkerCardOnRecenter({
        selectedCustomerId,
        selectedGroupKey,
      }),
    })
  }, [
    loading,
    mapCustomers,
    selectedCustomerId,
    selectedGroupKey,
    initialFocusCustomerId,
    applyCustomerFocus,
  ])

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
    if (findMapCustomerById(mapCustomers, pending)) {
      const group = findMarkerGroupByCustomerId(markerGroups, pending)
      const row = findMapCustomerById(mapCustomers, pending)
      setSelectedCustomerId(Number(pending))
      setSelectedGroupKey(
        group?.groupKey ??
          (row ? buildCoordinateGroupKey(row.latitude, row.longitude) : null),
      )
      pendingSelectedCustomerIdRef.current = null
      return
    }
    pendingSelectedCustomerIdRef.current = null
    /** 상세 path 고객은 selection clear 하지 않음 — recenter 가 path fallback 사용 */
    if (openDetailInWorkspaceMap && sameCustomerMapId(pending, initialFocusCustomerId)) {
      return
    }
    setSelectedCustomerId(null)
    setSelectedGroupKey(null)
  }, [
    mapCustomers,
    markerGroups,
    loading,
    boundsLoading,
    mapBounds,
    openDetailInWorkspaceMap,
    initialFocusCustomerId,
  ])

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
    if (findMapCustomerById(mapCustomers, selectedCustomerId)) {
      return
    }
    if (
      openDetailInWorkspaceMap &&
      sameCustomerMapId(selectedCustomerId, initialFocusCustomerId)
    ) {
      return
    }
    setSelectedCustomerId(null)
    setSelectedGroupKey(null)
  }, [
    mapCustomers,
    selectedCustomerId,
    loading,
    boundsLoading,
    openDetailInWorkspaceMap,
    initialFocusCustomerId,
  ])

  const onSelectMarkerGroup = useCallback(
    (groupKey: string, customerId?: number | null) => {
      const group = markerGroups.find((row) => row.groupKey === groupKey)
      if (!group) {
        return
      }
      pendingSelectedCustomerIdRef.current = null
      userDismissedMarkerCardRef.current = false
      setSelectedGroupKey(groupKey)
      setSelectedCustomerId(customerId ?? group.customers[0]?.id ?? null)
    },
    [markerGroups],
  )

  const onHighlightCustomer = useCallback((customerId: number) => {
    setSelectedCustomerId(customerId)
  }, [])

  const clearMapCustomerSelection = useCallback(() => {
    const cleared = clearCustomerMapSelection()
    pendingSelectedCustomerIdRef.current = null
    userDismissedMarkerCardRef.current = true
    setSelectedCustomerId(cleared.selectedCustomerId)
    setSelectedGroupKey(cleared.selectedGroupKey)
  }, [])

  const onCloseMarkerCard = useCallback(() => {
    clearMapCustomerSelection()
  }, [clearMapCustomerSelection])

  const onToggleUnmappedList = useCallback(() => {
    setShowUnmappedList((prev) => !prev)
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

  const onOpenCustomerDetail = useCallback(
    (customerId: number) => {
      if (openDetailInWorkspaceMap) {
        const qs = new URLSearchParams()
        qs.set('customerId', String(customerId))
        navigate(`${buildCustomerDetailMapPath(customerId)}?${qs.toString()}`)
        return
      }
      const customer =
        mapCustomers.find((row) => row.id === customerId) ??
        unmappedCustomers.find((row) => row.id === customerId)
      openCustomerDetailFromMap({
        customerId,
        customerName: customer?.name,
        isMobile,
        mapState: buildMapState(),
        navigate,
      })
    },
    [
      openDetailInWorkspaceMap,
      mapCustomers,
      unmappedCustomers,
      isMobile,
      buildMapState,
      navigate,
    ],
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

  const selectedMarkerGroup = useMemo(() => {
    if (selectedGroupKey) {
      return markerGroups.find((group) => group.groupKey === selectedGroupKey) ?? null
    }
    if (selectedCustomerId != null) {
      return findMarkerGroupByCustomerId(markerGroups, selectedCustomerId)
    }
    return null
  }, [markerGroups, selectedGroupKey, selectedCustomerId])

  return {
    loading,
    boundsLoading,
    error,
    customers,
    mapCustomers,
    markerGroups,
    unmappedCustomers,
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
    selectedGroupKey,
    selectedMarkerGroup,
    showUnmappedList,
    focusNotice,
    skipAutoFit,
    mapCenterApplyKey,
    canRecenterToSelectedCustomer,
    onRecenterToSelectedCustomer,
    onRadiusChange: (nextRadius) => {
      setRadiusKm(nextRadius)
      if (nextRadius != null && nextRadius > 0) {
        setUseExplicitCenter(true)
      } else {
        setUseExplicitCenter(false)
      }
    },
    onOpenCustomerDetail,
    onFavoriteOnlyChange: setFavoriteOnly,
    onKeywordChange: setKeyword,
    onSelectMarkerGroup,
    onHighlightCustomer,
    onCloseMarkerCard,
    onToggleUnmappedList,
    onViewportChange: (lat, lng, zoom) => {
      setViewportCenterLat(lat)
      setViewportCenterLng(lng)
      setViewportZoom(zoom)
    },
    onBoundsIdle,
  }
}
