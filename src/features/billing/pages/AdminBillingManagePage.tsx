import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { useAuth } from '../../auth/AuthProvider'
import {
  BILLING_PLAN_SOURCE_LABEL,
  BILLING_STATUS_LABEL,
  fetchAdminBillingInvoices,
  fetchAdminBillingPlans,
  fetchAdminBillingSettings,
  fetchAdminBillingUsers,
  fetchAdminGaBillingPlans,
  fetchAdminReferralBillingPolicy,
  formatBillingDate,
  formatWon,
  INVOICE_STATUS_LABEL,
  mockPayAdminBillingInvoice,
  updateAdminBillingSettings,
  updateAdminGaBillingPlan,
  updateAdminUserBillingPlan,
  type BillingInvoice,
  type BillingPlanAdminRow,
  type BillingUserAdminRow,
  type GaBillingPlanAdminRow,
  type PaymentMode,
  type PaymentSettingsAdmin,
  type ReferralBillingPolicyAdmin,
} from '../api/billingApi'
import { formatPricingBreakdown } from '../pricingPolicy'
import {
  normalizePaymentMode,
  normalizePaymentProvider,
  PAYMENT_MODE_OPTIONS,
  PAYMENT_PROVIDER_OPTIONS,
} from '../billingConfig'

const TABS = [
  { id: 'plans', label: '요금제 관리' },
  { id: 'ga-plans', label: 'GA별 요금제' },
  { id: 'users', label: '구독 사용자' },
  { id: 'invoices', label: '결제/청구 내역' },
  { id: 'referral', label: '할인·추천인 정책' },
  { id: 'payment', label: '결제 연동 설정' },
] as const

type TabId = (typeof TABS)[number]['id']

function planSelectOptions(plans: BillingPlanAdminRow[]) {
  return plans.map((plan) => ({
    value: plan.dbCode,
    label: `${plan.label} (${plan.displayPriceWithVatNote})`,
  }))
}

export default function AdminBillingManagePage() {
  const { token, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'plans'

  const [plans, setPlans] = useState<BillingPlanAdminRow[]>([])
  const [gaPlans, setGaPlans] = useState<GaBillingPlanAdminRow[]>([])
  const [billingUsers, setBillingUsers] = useState<BillingUserAdminRow[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [referralPolicy, setReferralPolicy] = useState<ReferralBillingPolicyAdmin | null>(null)
  const [settings, setSettings] = useState<PaymentSettingsAdmin | null>(null)

  const [gaDrafts, setGaDrafts] = useState<Record<number, string>>({})
  const [userDrafts, setUserDrafts] = useState<Record<string, string>>({})

  const [mode, setMode] = useState<'virtual' | 'live'>('virtual')
  const [provider, setProvider] = useState('toss')
  const [clientKey, setClientKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)

  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  const setTab = (tab: TabId) => {
    setSearchParams({ tab }, { replace: true })
  }

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setLoadError('')
    try {
      const [planRes, gaRes, userRes, invRes, referralRes, settingsRes] = await Promise.all([
        fetchAdminBillingPlans(token),
        fetchAdminGaBillingPlans(token),
        fetchAdminBillingUsers(token),
        fetchAdminBillingInvoices(token),
        fetchAdminReferralBillingPolicy(token),
        fetchAdminBillingSettings(token),
      ])
      setPlans(planRes.plans)
      setGaPlans(gaRes.gaPlans)
      setBillingUsers(userRes.users)
      setInvoices(invRes.invoices)
      setReferralPolicy(referralRes)
      setSettings(settingsRes)
      setMode(normalizePaymentMode(settingsRes.mode))
      setProvider(normalizePaymentProvider(settingsRes.provider))
      setIsEnabled(Boolean(settingsRes.isEnabled))
      setGaDrafts(
        Object.fromEntries(
          gaRes.gaPlans.map((row) => [row.gaId, row.defaultPlanCode ?? row.effectivePlanCode]),
        ),
      )
      setUserDrafts(
        Object.fromEntries(
          userRes.users.map((row) => [row.userId, row.userOverridePlanCode ?? '']),
        ),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const planOptions = useMemo(() => planSelectOptions(plans), [plans])
  const isVirtualMode = normalizePaymentMode(settings?.mode ?? mode) === 'virtual'

  const onSaveGaPlan = async (gaId: number) => {
    if (!token?.trim() || busy) return
    const planCode = gaDrafts[gaId]
    if (!planCode) return
    setBusy(true)
    setActionError('')
    setActionInfo('')
    try {
      await updateAdminGaBillingPlan(token, gaId, planCode)
      setActionInfo('GA 기본 요금제가 저장되었습니다. 다음 invoice 생성부터 적용됩니다.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'GA 요금제 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onSaveUserPlan = async (userId: string) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    setActionInfo('')
    try {
      const draft = userDrafts[userId] ?? ''
      await updateAdminUserBillingPlan(token, userId, draft.trim() ? draft.trim() : null)
      setActionInfo('사용자 요금제 설정이 저장되었습니다.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '사용자 요금제 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onClearUserOverride = async (userId: string) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    setActionInfo('')
    try {
      await updateAdminUserBillingPlan(token, userId, null)
      setActionInfo('사용자 예외 요금제가 해제되었습니다.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '예외 해제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onSavePaymentSettings = async () => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setSaveError('')
    setSaveOk('')
    try {
      const updated = await updateAdminBillingSettings(token, {
        mode: normalizePaymentMode(mode),
        provider: normalizePaymentProvider(provider),
        isEnabled,
        clientKey: clientKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      })
      setSettings(updated)
      setClientKey('')
      setSecretKey('')
      setWebhookSecret('')
      setSaveOk('결제 설정이 저장되었습니다.')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onMockPay = async (invoiceId: number) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    try {
      await mockPayAdminBillingInvoice(token, invoiceId)
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '가상 결제 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>결제·구독 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back billing-admin-page">
      <header className="page-header">
        <h1>결제·구독 관리</h1>
        <p>요금제 · GA 설정 · 구독 · 청구 · 추천인 할인 · 결제 연동</p>
      </header>

      <nav className="billing-admin-tabs" aria-label="결제·구독 관리 탭">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`billing-admin-tabs__btn${activeTab === tab.id ? ' billing-admin-tabs__btn--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loadError ? <StatusMessage tone="error" message={loadError} /> : null}
      {actionInfo ? <StatusMessage message={actionInfo} /> : null}
      {actionError ? <StatusMessage tone="error" message={actionError} /> : null}

      {activeTab === 'plans' ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">등록 요금제</h2>
          {plans.length === 0 ? (
            <p className="status text-sm">등록된 요금제가 없습니다.</p>
          ) : (
            <ul className="billing-page__invoice-list">
              {plans.map((plan) => (
                <li key={plan.dbCode} className="billing-page__invoice-item">
                  <div className="billing-page__invoice-head">
                    <strong>
                      {plan.label} ({plan.dbCode})
                    </strong>
                    <span>{plan.displayPriceWithVatNote}</span>
                  </div>
                  <p className="billing-page__invoice-sub">
                    {formatPricingBreakdown({
                      supplyAmount: plan.supplyAmount,
                      vatAmount: plan.vatAmount,
                      totalAmount: plan.totalAmount,
                    })}
                    {plan.allowsReferralDiscount ? '' : ' · 추천인 할인 미적용'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'ga-plans' ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">GA별 기본 요금제</h2>
          <p className="status text-sm">저장 후 다음 invoice 생성부터 적용됩니다. 기존 청구서 금액은 변경되지 않습니다.</p>
          <ul className="billing-page__invoice-list">
            {gaPlans.map((row) => (
              <li key={row.gaId} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>
                    {row.gaName} ({row.gaCode})
                  </strong>
                  <span>사용자 {row.userCount}명</span>
                </div>
                <p className="billing-page__invoice-sub">
                  현재 적용: {row.displayPriceWithVatNote}
                  {row.usesGeneralFallback ? ' · GENERAL 기본 상속' : ''}
                </p>
                <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
                  {formatPricingBreakdown({
                    supplyAmount: row.supplyAmount,
                    vatAmount: row.vatAmount,
                    totalAmount: row.totalAmount,
                  })}
                </p>
                <div className="billing-page__actions">
                  <FieldWrapper label="기본 요금제">
                    <FormSelect
                      value={gaDrafts[row.gaId] ?? row.effectivePlanCode}
                      options={planOptions}
                      onChange={(e) =>
                        setGaDrafts((prev) => ({ ...prev, [row.gaId]: e.target.value }))
                      }
                    />
                  </FieldWrapper>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onSaveGaPlan(row.gaId)}
                  >
                    저장
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === 'users' ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">구독 사용자</h2>
          <ul className="billing-page__invoice-list">
            {billingUsers.map((row) => (
              <li key={row.userId} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>{row.userName}</strong>
                  <span>{BILLING_STATUS_LABEL[row.subscriptionStatus] ?? row.subscriptionStatus}</span>
                </div>
                <p className="billing-page__invoice-sub">
                  GA {row.gaName} ({row.gaCode}) · GA 기본 {row.gaDefaultPlanCode ?? '—'} · 사용자 예외{' '}
                  {row.userOverridePlanCode ?? '없음'}
                </p>
                <p className="billing-page__invoice-sub">
                  실제 적용: {row.displayPriceWithVatNote} ·{' '}
                  {BILLING_PLAN_SOURCE_LABEL[row.effectivePlanSource] ?? row.effectivePlanSource}
                </p>
                <div className="billing-page__actions">
                  <FieldWrapper label="사용자 예외 요금제">
                    <FormSelect
                      value={userDrafts[row.userId] ?? ''}
                      options={[{ value: '', label: '예외 없음 (GA 기본)' }, ...planOptions]}
                      onChange={(e) =>
                        setUserDrafts((prev) => ({ ...prev, [row.userId]: e.target.value }))
                      }
                    />
                  </FieldWrapper>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onSaveUserPlan(row.userId)}
                  >
                    저장
                  </FormButton>
                  {row.userOverridePlanCode ? (
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onClearUserOverride(row.userId)}
                    >
                      예외 해제
                    </FormButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="card auth-card billing-page__card">
          <h2 className="billing-page__section-title">결제/청구 내역</h2>
          {invoices.length === 0 ? (
            <p className="status text-sm">결제 내역이 없습니다.</p>
          ) : (
            <ul className="billing-page__invoice-list">
              {invoices.slice(0, 50).map((row) => (
                <li key={row.id} className="billing-page__invoice-item">
                  <div className="billing-page__invoice-head">
                    <strong>
                      {row.userName ?? row.userId} · {formatWon(row.finalAmount)}
                    </strong>
                    <span>{INVOICE_STATUS_LABEL[row.status] ?? row.status}</span>
                  </div>
                  <p className="billing-page__invoice-sub">
                    planCode {row.planCode} · {formatBillingDate(row.createdAt)}
                  </p>
                  {row.baseSupplyAmount != null && row.vatAmount != null ? (
                    <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
                      {formatPricingBreakdown({
                        supplyAmount: row.finalSupplyAmount ?? row.baseSupplyAmount,
                        vatAmount: row.vatAmount,
                        totalAmount: row.finalAmount,
                      })}
                    </p>
                  ) : null}
                  {isVirtualMode && row.status === 'pending' ? (
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onMockPay(row.id)}
                    >
                      가상 결제 완료 처리
                    </FormButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'referral' ? (
        <>
          <section className="card auth-card billing-page__card">
            <h2 className="billing-page__section-title">할인·추천인 정책</h2>
            {referralPolicy ? (
              <dl className="billing-page__meta">
                <dt>기본 월 공급가</dt>
                <dd>{formatWon(referralPolicy.baseMonthlySupplyAmount)}</dd>
                <dt>추천인 1명당 공급가 할인</dt>
                <dd>{formatWon(referralPolicy.referrerDiscountPerActiveReferral)}</dd>
                <dt>피추천인 1회차 공급가 할인</dt>
                <dd>{formatWon(referralPolicy.refereeFirstMonthDiscountAmount)}</dd>
                <dt>최대 추천인 할인 인원</dt>
                <dd>{referralPolicy.maxReferrerDiscountCount}명</dd>
              </dl>
            ) : null}
            {referralPolicy?.notes?.length ? (
              <ul className="billing-page__policy-list">
                {referralPolicy.notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}

      {activeTab === 'payment' ? (
        <>
          <section className="card auth-card billing-page__card">
            <h2 className="billing-page__section-title">결제 모드</h2>
            <FieldWrapper label="모드">
              <FormSelect
                value={normalizePaymentMode(mode)}
                options={[...PAYMENT_MODE_OPTIONS]}
                onChange={(e) => setMode(normalizePaymentMode(e.target.value))}
              />
            </FieldWrapper>
            <FieldWrapper label="PG사">
              <FormSelect
                value={normalizePaymentProvider(provider)}
                options={[...PAYMENT_PROVIDER_OPTIONS]}
                onChange={(e) => setProvider(normalizePaymentProvider(e.target.value))}
              />
            </FieldWrapper>
            <label className="field">
              <span className="field__label">실결제 사용</span>
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
            </label>
          </section>
          <section className="card auth-card billing-page__card">
            <h2 className="billing-page__section-title">PG 키 (선택)</h2>
            <p className="status text-sm">가상 결제 모드에서는 키 없이 운영할 수 있습니다.</p>
            <FieldWrapper label="클라이언트 키 (새로 저장)">
              <FormInput value={clientKey} onChange={(e) => setClientKey(e.target.value)} autoComplete="off" />
            </FieldWrapper>
            <FieldWrapper label="시크릿 키 (새로 저장)">
              <FormInput
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="new-password"
              />
            </FieldWrapper>
            <FieldWrapper label="웹훅 시크릿 (선택)">
              <FormInput
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="new-password"
              />
            </FieldWrapper>
            <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void onSavePaymentSettings()}>
              {busy ? '저장 중…' : '저장'}
            </FormButton>
            {saveOk ? <StatusMessage message={saveOk} /> : null}
            {saveError ? <StatusMessage tone="error" message={saveError} /> : null}
          </section>
        </>
      ) : null}
    </main>
  )
}

export function AdminBillingLegacyRedirect({ tab }: { tab: TabId }) {
  return <Navigate to={`/admin/billing/manage?tab=${tab}`} replace />
}
