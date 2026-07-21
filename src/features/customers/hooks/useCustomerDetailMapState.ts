import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById } from '../api/customersApi'
import {
  fetchCustomerMap,
  type CustomerMapListItem,
  type CustomerMapUnmappedItem,
  type CustomerMapViewportBounds,
} from '../api/customerMapApi'
import {
  CUSTOMER_MAP_DEFAULT_CENTER,
  CUSTOMER_MAP_FOCUS_ZOOM,
} from '../config/customerMap.config'
import { buildCoordinateGroupKey } from '../utils/customerMapMarkerGroups'
import { CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE } from '../utils/customerMapFocusNavigation'
import type { CustomerRecord } from '../domain/types'

export type CustomerDetailMapStatus =
  | 'loading'
  | 'ready'
  | 'no_address'
  | 'unmapped'
  | 'unavailable'
  | 'error'

export type CustomerDetailMapState = {
  status: CustomerDetailMapStatus
  error: string | null
  customer: CustomerRecord | null
  mapCustomer: CustomerMapListItem | null
  unmapped: CustomerMapUnmappedItem | null
  mapCustomers: CustomerMapListItem[]
  centerLat: number
  centerLng: number
  zoom: number
  selectedGroupKey: string | null
  autoFitKey: string
  statusMessage: string | null
  onViewportChange: (centerLat: number, centerLng: number, zoom: number) => void
  onBoundsIdle: (bounds: CustomerMapViewportBounds) => void
  onSelectMarkerGroup: (groupKey: string, customerId?: number | null) => void
}

function buildMapKeyword(customer: CustomerRecord): string {
  const phone = String(customer.phone ?? customer.phoneNumber ?? '').replace(/\D/g, '')
  if (phone.length >= 8) {
    return phone
  }
  return String(customer.name ?? '').trim()
}

/**
 * 고객 상세 지도 탭 전용 — 선택 고객 1명만 조회·표시.
 * 전체 고객지도(`useCustomerMapState`)와 상태·필터를 공유하지 않는다.
 */
export function useCustomerDetailMapState(customerId: number | null): CustomerDetailMapState {
  const { token } = useAuth()
  const [status, setStatus] = useState<CustomerDetailMapStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerRecord | null>(null)
  const [mapCustomer, setMapCustomer] = useState<CustomerMapListItem | null>(null)
  const [unmapped, setUnmapped] = useState<CustomerMapUnmappedItem | null>(null)
  const [centerLat, setCenterLat] = useState(CUSTOMER_MAP_DEFAULT_CENTER.lat)
  const [centerLng, setCenterLng] = useState(CUSTOMER_MAP_DEFAULT_CENTER.lng)
  const [zoom, setZoom] = useState(CUSTOMER_MAP_FOCUS_ZOOM)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [autoFitKey, setAutoFitKey] = useState('')

  useEffect(() => {
    if (!token?.trim() || customerId == null || customerId <= 0) {
      setStatus('unavailable')
      setCustomer(null)
      setMapCustomer(null)
      setUnmapped(null)
      setError(null)
      return
    }

    let cancelled = false
    setStatus('loading')
    setError(null)
    setMapCustomer(null)
    setUnmapped(null)

    void (async () => {
      try {
        const row = await getCustomerById(token, customerId)
        if (cancelled) return
        setCustomer(row)

        const address = String(row.address ?? '').trim()
        if (!address) {
          setStatus('no_address')
          return
        }

        const keyword = buildMapKeyword(row)
        const mapRes = await fetchCustomerMap(token, keyword ? { keyword } : {})
        if (cancelled) return

        const mapped = mapRes.mapCustomers.find((c) => c.id === customerId) ?? null
        const unmappedRow = mapRes.unmappedCustomers.find((c) => c.id === customerId) ?? null

        if (mapped) {
          setMapCustomer(mapped)
          setUnmapped(null)
          setCenterLat(mapped.latitude)
          setCenterLng(mapped.longitude)
          setZoom(CUSTOMER_MAP_FOCUS_ZOOM)
          setSelectedGroupKey(buildCoordinateGroupKey(mapped.latitude, mapped.longitude))
          setAutoFitKey(`detail-${customerId}-${mapped.latitude}-${mapped.longitude}`)
          setStatus('ready')
          return
        }

        if (unmappedRow) {
          setUnmapped(unmappedRow)
          setStatus('unmapped')
          return
        }

        setStatus('unavailable')
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : '지도 정보를 불러오지 못했습니다.')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, customerId])

  const mapCustomers = useMemo(
    () => (mapCustomer ? [mapCustomer] : []),
    [mapCustomer],
  )

  const statusMessage = useMemo(() => {
    if (status === 'no_address') {
      return '등록된 주소가 없습니다.'
    }
    if (status === 'unmapped') {
      if (unmapped?.mapStatus === 'geocode_failed') {
        return '주소 위치를 지도에서 확인할 수 없습니다.'
      }
      return CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE
    }
    if (status === 'unavailable') {
      return CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE
    }
    return null
  }, [status, unmapped])

  const onViewportChange = useCallback((nextLat: number, nextLng: number, nextZoom: number) => {
    setCenterLat(nextLat)
    setCenterLng(nextLng)
    setZoom(nextZoom)
  }, [])

  const onBoundsIdle = useCallback((_bounds: CustomerMapViewportBounds) => {
    // 상세 지도는 viewport 재조회 없음
  }, [])

  const onSelectMarkerGroup = useCallback((groupKey: string, _customerId?: number | null) => {
    setSelectedGroupKey(groupKey)
  }, [])

  return {
    status,
    error,
    customer,
    mapCustomer,
    unmapped,
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
  }
}
