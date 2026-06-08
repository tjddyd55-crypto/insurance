import { useEffect, useRef, useState } from 'react'
import type { CustomerMapListItem, CustomerMapViewportBounds } from '../../api/customerMapApi'
import type { MapProviderName } from '../../config/customerMap.config'
import { MapSdkError } from './mapSdkErrors'
import {
  waitForUsableMapContainerSize,
} from './naverMapContainer'
import {
  buildCustomerMapMarkerHtml,
  CUSTOMER_MAP_NAME_MARKER_SIZE,
} from './customerMapMarkerHtml'
import {
  kakaoLevelFromZoom,
  loadMapProviderSdk,
  onNaverMapAuthFailure,
  wasNaverSdkCallbackCompleted,
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
  autoFitKey: string
  onViewportChange: (centerLat: number, centerLng: number, zoom: number) => void
  onBoundsIdle: (bounds: CustomerMapViewportBounds) => void
  onSelectCustomer: (customerId: number | null) => void
  onMapInitFailed?: () => void
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

function readMapViewportBounds(
  provider: MapProviderName,
  map: unknown,
  zoom: number,
): CustomerMapViewportBounds | null {
  if (provider === 'naver' && window.naver?.maps) {
    const bounds = (
      map as {
        getBounds: () => {
          getNE: () => { lat: () => number; lng: () => number }
          getSW: () => { lat: () => number; lng: () => number }
        }
      }
    ).getBounds()
    const ne = bounds.getNE()
    const sw = bounds.getSW()
    return {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
      zoom,
    }
  }
  if (provider === 'kakao' && window.kakao?.maps) {
    const bounds = (
      map as {
        getBounds: () => {
          getNorthEast: () => { getLat: () => number; getLng: () => number }
          getSouthWest: () => { getLat: () => number; getLng: () => number }
        }
      }
    ).getBounds()
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()
    return {
      north: ne.getLat(),
      south: sw.getLat(),
      east: ne.getLng(),
      west: sw.getLng(),
      zoom,
    }
  }
  return null
}

export default function CustomerMapCanvas({
  provider,
  clientKey,
  customers,
  centerLat,
  centerLng,
  zoom,
  selectedCustomerId,
  autoFitKey,
  onViewportChange,
  onBoundsIdle,
  onSelectCustomer,
  onMapInitFailed,
}: CustomerMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const skipCenterSyncRef = useRef(false)
  const onViewportChangeRef = useRef(onViewportChange)
  const onBoundsIdleRef = useRef(onBoundsIdle)
  const onSelectCustomerRef = useRef(onSelectCustomer)
  const onMapInitFailedRef = useRef(onMapInitFailed)
  const lastAutoFitKeyRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  onViewportChangeRef.current = onViewportChange
  onBoundsIdleRef.current = onBoundsIdle
  onSelectCustomerRef.current = onSelectCustomer
  onMapInitFailedRef.current = onMapInitFailed

  useEffect(() => {
    if (provider !== 'naver') {
      return undefined
    }
    return onNaverMapAuthFailure(() => {
      onMapInitFailedRef.current?.()
    })
  }, [provider])

  useEffect(() => {
    if (provider === 'none' || !clientKey || !containerRef.current) {
      return undefined
    }

    let cancelled = false
    const container = containerRef.current

    void (async () => {
      const containerSize = await waitForUsableMapContainerSize(container)
      if (cancelled || !containerRef.current) {
        return
      }

      await loadMapProviderSdk(provider, clientKey)
      if (cancelled || !containerRef.current) {
        return
      }

      if (provider === 'naver' && !wasNaverSdkCallbackCompleted()) {
        throw new MapSdkError('sdk_global_missing')
      }

      try {
        if (provider === 'naver' && window.naver?.maps) {
          const { maps } = window.naver
          const map = new maps.Map(containerRef.current, {
            center: new maps.LatLng(centerLat, centerLng),
            zoom,
            size: new maps.Size(containerSize.width, containerSize.height),
            zoomControl: true,
            zoomControlOptions: {
              position: maps.Position.TOP_RIGHT,
            },
            mapDataControl: false,
          })
          mapRef.current = map
          maps.Event.addListener(map, 'idle', () => {
            if (skipCenterSyncRef.current) {
              return
            }
            const c = map.getCenter()
            const currentZoom = map.getZoom()
            onViewportChangeRef.current(c.lat(), c.lng(), currentZoom)
            const bounds = readMapViewportBounds(provider, map, currentZoom)
            if (bounds) {
              onBoundsIdleRef.current(bounds)
            }
          })
          maps.Event.trigger(map, 'resize')
          setMapReady(true)
          return
        }

        if (provider === 'kakao' && window.kakao?.maps) {
          const { maps } = window.kakao
          const map = new maps.Map(containerRef.current, {
            center: new maps.LatLng(centerLat, centerLng),
            level: kakaoLevelFromZoom(zoom),
          })
          mapRef.current = map
          maps.event.addListener(map, 'idle', () => {
            if (skipCenterSyncRef.current) {
              return
            }
            const c = map.getCenter()
            const currentZoom = zoomFromKakaoLevel(map.getLevel())
            onViewportChangeRef.current(c.getLat(), c.getLng(), currentZoom)
            const bounds = readMapViewportBounds(provider, map, currentZoom)
            if (bounds) {
              onBoundsIdleRef.current(bounds)
            }
          })
          setMapReady(true)
        }
      } catch (error) {
        console.error('[customer-map] map init failed:', error instanceof MapSdkError ? error.code : 'map_init_failed')
        onMapInitFailedRef.current?.()
      }
    })().catch((error) => {
      console.error('[customer-map] map init failed:', error instanceof MapSdkError ? error.code : 'map_init_failed')
      onMapInitFailedRef.current?.()
    })

    return () => {
      cancelled = true
      mapRef.current = null
      markersRef.current = []
      setMapReady(false)
      lastAutoFitKeyRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance 1회 생성
  }, [provider, clientKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || customers.length === 0) {
      return
    }
    if (lastAutoFitKeyRef.current === autoFitKey) {
      return
    }
    skipCenterSyncRef.current = true
    fitMapToCustomers(provider, map, customers, centerLat, centerLng, zoom)
    lastAutoFitKeyRef.current = autoFitKey
    window.setTimeout(() => {
      skipCenterSyncRef.current = false
    }, 150)
  }, [autoFitKey, customers, mapReady, provider, centerLat, centerLng, zoom])

  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !map || !mapReady) {
      return undefined
    }

    const triggerResize = () => {
      if (provider === 'naver' && window.naver?.maps) {
        window.naver.maps.Event.trigger(map, 'resize')
      }
    }

    const observer = new ResizeObserver(() => {
      triggerResize()
    })
    observer.observe(container)
    triggerResize()

    return () => {
      observer.disconnect()
    }
  }, [provider, mapReady])

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
          zIndex: selected ? 200 : 100,
          icon: {
            content: buildCustomerMapMarkerHtml(customer.name, selected),
            size: new maps.Size(
              CUSTOMER_MAP_NAME_MARKER_SIZE.width,
              CUSTOMER_MAP_NAME_MARKER_SIZE.height,
            ),
            anchor: new maps.Point(
              CUSTOMER_MAP_NAME_MARKER_SIZE.anchorX,
              CUSTOMER_MAP_NAME_MARKER_SIZE.anchorY,
            ),
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
