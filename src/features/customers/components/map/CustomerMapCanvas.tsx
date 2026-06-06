import { useEffect, useRef } from 'react'
import type { CustomerMapMarker } from '../../api/customerMapApi'
import type { MapProviderName } from '../../config/customerMap.config'
import {
  kakaoLevelFromZoom,
  loadMapProviderSdk,
  zoomFromKakaoLevel,
} from './mapSdkLoader'

type CustomerMapCanvasProps = {
  provider: MapProviderName
  clientKey: string
  customers: CustomerMapMarker[]
  centerLat: number
  centerLng: number
  zoom: number
  selectedCustomerId: number | null
  onCenterChange: (centerLat: number, centerLng: number, zoom: number) => void
  onSelectCustomer: (customer: CustomerMapMarker | null) => void
}

function markerHtml(selected: boolean): string {
  const cls = selected
    ? 'customer-map-marker customer-map-marker--selected'
    : 'customer-map-marker'
  return `<div class="${cls}" aria-hidden="true"></div>`
}

export default function CustomerMapCanvas({
  provider,
  clientKey,
  customers,
  centerLat,
  centerLng,
  zoom,
  selectedCustomerId,
  onCenterChange,
  onSelectCustomer,
}: CustomerMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const skipCenterSyncRef = useRef(false)
  const onCenterChangeRef = useRef(onCenterChange)
  const onSelectCustomerRef = useRef(onSelectCustomer)

  onCenterChangeRef.current = onCenterChange
  onSelectCustomerRef.current = onSelectCustomer

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
        })
        mapRef.current = map
        maps.Event.addListener(map, 'idle', () => {
          if (skipCenterSyncRef.current) {
            return
          }
          const c = map.getCenter()
          onCenterChangeRef.current(c.lat(), c.lng(), map.getZoom())
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
        maps.event.addListener(map, 'idle', () => {
          if (skipCenterSyncRef.current) {
            return
          }
          const c = map.getCenter()
          onCenterChangeRef.current(c.getLat(), c.getLng(), zoomFromKakaoLevel(map.getLevel()))
        })
      }
    })().catch(() => {
      // 상위 MapProviderLoader 가 안내 표시
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
            content: markerHtml(selected),
            anchor: new maps.Point(10, 10),
          },
        })
        maps.Event.addListener(marker, 'click', () => {
          onSelectCustomerRef.current(customer)
        })
        markersRef.current.push(marker)
      }
      return
    }

    if (provider === 'kakao' && window.kakao?.maps) {
      const { maps } = window.kakao
      for (const customer of customers) {
        const selected = customer.id === selectedCustomerId
        const marker = new maps.Marker({
          position: new maps.LatLng(customer.latitude, customer.longitude),
          map,
          clickable: true,
        })
        const el = marker as unknown as { setImage?: (img: unknown) => void }
        if (typeof el.setImage === 'function') {
          // 기본 마커 유지 — 선택은 카드로 표시
          void selected
        }
        maps.event.addListener(marker, 'click', () => {
          onSelectCustomerRef.current(customer)
        })
        markersRef.current.push(marker)
      }
    }
  }, [customers, selectedCustomerId, provider])

  return <div ref={containerRef} className="customer-map-canvas" role="presentation" />
}
