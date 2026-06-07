import { useEffect, useRef } from 'react'
import type { CustomerMapListItem } from '../../api/customerMapApi'
import type { MapProviderName } from '../../config/customerMap.config'
import {
  kakaoLevelFromZoom,
  loadMapProviderSdk,
  zoomFromKakaoLevel,
} from './mapSdkLoader'

type CustomerMapCanvasProps = {
  provider: MapProviderName
  clientKey: string
  customers: CustomerMapListItem[]
  centerLat: number
  centerLng: number
  zoom: number
  selectedCustomerId: number | null
  onViewportChange: (centerLat: number, centerLng: number, zoom: number) => void
  onSelectCustomer: (customerId: number | null) => void
}

function markerHtml(markerNo: number, selected: boolean): string {
  const cls = selected
    ? 'customer-map-marker customer-map-marker--selected'
    : 'customer-map-marker'
  return `<div class="${cls}"><span class="customer-map-marker__no">${markerNo}</span></div>`
}

function fitMapToCustomers(
  provider: MapProviderName,
  map: unknown,
  customers: CustomerMapListItem[],
  fallbackCenterLat: number,
  fallbackCenterLng: number,
  fallbackZoom: number,
) {
  if (customers.length === 0) {
    return
  }
  if (provider === 'naver' && window.naver?.maps) {
    const { maps } = window.naver
    if (customers.length === 1) {
      const c = customers[0]
      ;(map as { setCenter: (v: unknown) => void; setZoom: (z: number) => void }).setCenter(
        new maps.LatLng(c.latitude, c.longitude),
      )
      ;(map as { setZoom: (z: number) => void }).setZoom(Math.max(fallbackZoom, 14))
      return
    }
    const bounds = new maps.LatLngBounds(
      new maps.LatLng(customers[0].latitude, customers[0].longitude),
      new maps.LatLng(customers[0].latitude, customers[0].longitude),
    )
    for (const customer of customers.slice(1)) {
      bounds.extend(new maps.LatLng(customer.latitude, customer.longitude))
    }
    ;(map as { fitBounds: (b: unknown, opts?: unknown) => void }).fitBounds(bounds, {
      top: 48,
      right: 48,
      bottom: 48,
      left: 48,
    })
    return
  }
  if (provider === 'kakao' && window.kakao?.maps) {
    const { maps } = window.kakao
    if (customers.length === 1) {
      const c = customers[0]
      ;(map as { setCenter: (v: unknown) => void; setLevel: (l: number) => void }).setCenter(
        new maps.LatLng(c.latitude, c.longitude),
      )
      ;(map as { setLevel: (l: number) => void }).setLevel(kakaoLevelFromZoom(Math.max(fallbackZoom, 14)))
      return
    }
    const bounds = new maps.LatLngBounds()
    for (const customer of customers) {
      bounds.extend(new maps.LatLng(customer.latitude, customer.longitude))
    }
    ;(map as { setBounds: (b: unknown) => void }).setBounds(bounds)
  }
}

export default function CustomerMapCanvas({
  provider,
  clientKey,
  customers,
  centerLat,
  centerLng,
  zoom,
  selectedCustomerId,
  onViewportChange,
  onSelectCustomer,
}: CustomerMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const skipCenterSyncRef = useRef(false)
  const onViewportChangeRef = useRef(onViewportChange)
  const onSelectCustomerRef = useRef(onSelectCustomer)
  const fittedRef = useRef(false)

  onViewportChangeRef.current = onViewportChange
  onSelectCustomerRef.current = onSelectCustomer

  useEffect(() => {
    fittedRef.current = false
  }, [customers])

  useEffect(() => {
    if (provider === 'none' || !clientKey || !containerRef.current) {
      return undefined
    }

    let cancelled = false

    void (async () => {
      await loadMapProviderSdk(provider, clientKey)
      if (cancelled || !containerRef.current) {
        return
      }

      if (provider === 'naver' && window.naver?.maps) {
        const { maps } = window.naver
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(centerLat, centerLng),
          zoom,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.TOP_RIGHT,
          },
          mapDataControl: false,
        })
        mapRef.current = map
        if (customers.length > 0 && !fittedRef.current) {
          fitMapToCustomers(provider, map, customers, centerLat, centerLng, zoom)
          fittedRef.current = true
        }
        maps.Event.addListener(map, 'idle', () => {
          if (skipCenterSyncRef.current) {
            return
          }
          const c = map.getCenter()
          onViewportChangeRef.current(c.lat(), c.lng(), map.getZoom())
        })
        return
      }

      if (provider === 'kakao' && window.kakao?.maps) {
        const { maps } = window.kakao
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(centerLat, centerLng),
          level: kakaoLevelFromZoom(zoom),
        })
        mapRef.current = map
        if (customers.length > 0 && !fittedRef.current) {
          fitMapToCustomers(provider, map, customers, centerLat, centerLng, zoom)
          fittedRef.current = true
        }
        maps.event.addListener(map, 'idle', () => {
          if (skipCenterSyncRef.current) {
            return
          }
          const c = map.getCenter()
          onViewportChangeRef.current(c.getLat(), c.getLng(), zoomFromKakaoLevel(map.getLevel()))
        })
      }
    })().catch(() => {
      // Shell fallback
    })

    return () => {
      cancelled = true
      mapRef.current = null
      markersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance 1회 생성
  }, [provider, clientKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    skipCenterSyncRef.current = true
    if (provider === 'naver' && window.naver?.maps) {
      const { maps } = window.naver
      ;(map as { setCenter: (v: unknown) => void; setZoom: (z: number) => void }).setCenter(
        new maps.LatLng(centerLat, centerLng),
      )
      ;(map as { setZoom: (z: number) => void }).setZoom(zoom)
    } else if (provider === 'kakao' && window.kakao?.maps) {
      const { maps } = window.kakao
      ;(map as { setCenter: (v: unknown) => void; setLevel: (l: number) => void }).setCenter(
        new maps.LatLng(centerLat, centerLng),
      )
      ;(map as { setLevel: (l: number) => void }).setLevel(kakaoLevelFromZoom(zoom))
    }
    window.setTimeout(() => {
      skipCenterSyncRef.current = false
    }, 0)
  }, [centerLat, centerLng, zoom, provider])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    for (const marker of markersRef.current) {
      if (provider === 'naver') {
        ;(marker as { setMap: (m: null) => void }).setMap(null)
      } else if (provider === 'kakao') {
        ;(marker as { setMap: (m: null) => void }).setMap(null)
      }
    }
    markersRef.current = []

    if (provider === 'naver' && window.naver?.maps) {
      const { maps } = window.naver
      for (const customer of customers) {
        const selected = customer.id === selectedCustomerId
        const marker = new maps.Marker({
          position: new maps.LatLng(customer.latitude, customer.longitude),
          map,
          icon: {
            content: markerHtml(customer.markerNo, selected),
            anchor: new maps.Point(14, 14),
          },
        })
        maps.Event.addListener(marker, 'click', () => {
          onSelectCustomerRef.current(customer.id)
        })
        markersRef.current.push(marker)
      }
      return
    }

    if (provider === 'kakao' && window.kakao?.maps) {
      const { maps } = window.kakao
      for (const customer of customers) {
        const marker = new maps.Marker({
          position: new maps.LatLng(customer.latitude, customer.longitude),
          map,
          clickable: true,
        })
        maps.event.addListener(marker, 'click', () => {
          onSelectCustomerRef.current(customer.id)
        })
        markersRef.current.push(marker)
      }
    }
  }, [customers, selectedCustomerId, provider])

  return <div ref={containerRef} className="customer-map-canvas" role="presentation" />
}
