import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { isInsuranceBillingEnabledClient } from '../insuranceBillingConfig'
import { fetchBillingManageSummary } from '../api/insuranceBillingApi'
import { buildBillingStatusBadgeView } from '../billingStatusBadgeUtils'
import { isSubscriptionSubjectRole } from '../../subscription/policy'
import { isBillingUiVisibleForUser } from '../../billing/storeReviewBillingAccess'
import '../billing-status-badge.css'

export default function BillingStatusBadge() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const shouldLoad =
    isInsuranceBillingEnabledClient() &&
    isBillingUiVisibleForUser(user) &&
    Boolean(token?.trim()) &&
    isSubscriptionSubjectRole(user?.role)

  const query = useQuery({
    queryKey: ['billing-manage-summary', token],
    queryFn: () => fetchBillingManageSummary(token!.trim()),
    enabled: shouldLoad,
    staleTime: 30_000,
  })

  if (!shouldLoad) {
    return null
  }

  if (query.isLoading || (query.isFetching && !query.data)) {
    return (
      <span className="billing-status-badge billing-status-badge--loading" aria-live="polite">
        상태 확인 중
      </span>
    )
  }

  if (query.isError) {
    return null
  }

  const view = buildBillingStatusBadgeView(query.data?.summary ?? null)
  if (!view) {
    return null
  }

  return (
    <button
      type="button"
      className={`billing-status-badge billing-status-badge--${view.variant}`}
      onClick={() => navigate(view.href)}
      aria-label={`결제 상태: ${view.label}. 클릭하면 결제 정보로 이동합니다.`}
    >
      {view.label}
    </button>
  )
}
