import { useEffect, useState } from 'react'
import {
  fetchCustomerMapStaticImageBlob,
  type FetchCustomerMapParams,
} from '../../api/customerMapApi'

type CustomerStaticMapImageProps = {
  token: string | null
  query: FetchCustomerMapParams
  configured: boolean
  hasMarkers: boolean
}

export default function CustomerStaticMapImage({
  token,
  query,
  configured,
  hasMarkers,
}: CustomerStaticMapImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!configured) {
      setImageUrl(null)
      setError('지도 설정이 필요합니다. 관리자에게 NAVER_MAPS_CLIENT_ID/SECRET 설정을 요청해 주세요.')
      return undefined
    }
    if (!hasMarkers) {
      setImageUrl(null)
      setError(null)
      return undefined
    }
    if (!token?.trim()) {
      setImageUrl(null)
      setError('로그인이 필요합니다.')
      return undefined
    }

    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError(null)

    void fetchCustomerMapStaticImageBlob(token, query)
      .then((blob) => {
        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        setImageUrl(null)
        setError(err instanceof Error ? err.message : 'Static Map 이미지를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [token, configured, hasMarkers, JSON.stringify(query)])

  if (!configured) {
    return (
      <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
        <p className="customer-map-setup-notice__title">지도 설정이 필요합니다</p>
        <p className="customer-map-setup-notice__body">
          서버에 NAVER_MAPS_CLIENT_ID / NAVER_MAPS_CLIENT_SECRET을 설정해 주세요.
        </p>
      </div>
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

  if (loading) {
    return (
      <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="status">
        <p className="customer-map-setup-notice__body">지도 이미지를 불러오는 중…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="customer-map-setup-notice customer-map-setup-notice--inline" role="alert">
        <p className="customer-map-setup-notice__body">{error}</p>
      </div>
    )
  }

  if (!imageUrl) {
    return null
  }

  return (
    <img
      src={imageUrl}
      alt="고객 위치 Static Map"
      className="customer-static-map-image"
      draggable={false}
    />
  )
}
