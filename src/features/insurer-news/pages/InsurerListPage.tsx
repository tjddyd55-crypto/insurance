import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { InsurerSelectorGrid } from '../components/InsurerSelectorGrid'
import { getInsurersForGa } from '../services/insurerNews.service'
import type { InsurerSummary } from '../types'

export function InsurerListPage() {
  const { user } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const navigate = useNavigate()
  const [insurers, setInsurers] = useState<InsurerSummary[]>([])

  useEffect(() => {
    if (!gaCode) {
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await getInsurersForGa(gaCode)
      if (!cancelled) {
        setInsurers(rows)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gaCode])

  if (!gaCode) {
    return null
  }

  return (
    <>
      <h2 className="insurer-news-hub__section-title">보험사 목록</h2>
      <p className="insurer-news-muted">보험사를 선택하면 해당 원수사 소식지만 모아볼 수 있습니다.</p>
      <InsurerSelectorGrid
        insurers={insurers}
        onSelect={(slug) => navigate(`/portal/newsletters/insurers/${slug}`)}
      />
    </>
  )
}
