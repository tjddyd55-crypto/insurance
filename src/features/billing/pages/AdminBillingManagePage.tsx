import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import { useAuth } from '../../auth/AuthProvider'
import {
  BillingPlanFormDialog,
  buildBillingPlanSelectOptions,
  type BillingPlanFormValues,
} from '../components/BillingPlanFormDialog'
import {
  BILLING_PLAN_SOURCE_LABEL,
  BILLING_STATUS_LABEL,
  createAdminBillingPlan,
  fetchAdminBillingPlans,
  fetchAdminBillingSettings,
  fetchAdminBillingUsers,
  fetchAdminGaBillingPlans,
  fetchAdminReferralBillingPolicy,
  formatWon,
  setAdminBillingPlanStatus,
  updateAdminBillingPlan,
  updateAdminBillingSettings,
  updateAdminGaBillingPlan,
  updateAdminUserBillingPlan,
  type BillingPlanAdminRow,
  type BillingUserAdminRow,
  type GaBillingPlanAdminRow,
  type PaymentMode,
  type PaymentSettingsAdmin,
  type ReferralBillingPolicyAdmin,
} from '../api/billingApi'
import { formatPricingBreakdown, formatReferralDiscountPolicySummary } from '../pricingPolicy'
import PromotionCodesAdminSection from '../components/PromotionCodesAdminSection'
import BillingPaymentsAdminSection from '../components/BillingPaymentsAdminSection'
import { AdminDataCard, AdminPageShell, AdminTabPanel } from '../../admin/components/layout'
import { BILLING_ADMIN_TAB_LAYOUT, BILLING_ADMIN_TABS, type BillingAdminTabId } from '../billingAdminTabLayout'
import {
  normalizePaymentMode,
  normalizePaymentProvider,
  PAYMENT_MODE_OPTIONS,
  PAYMENT_PROVIDER_OPTIONS,
} from '../billingConfig'

const PRICING_PRIORITY_NOTE =
  '요금 적용 우선순위: ① 사용자별 예외 요금제 → ② GA 기본 요금제 → ③ 전체 기본 요금제 → ④ 프로모션 코드 → ⑤ 추천 할인'

const LEGACY_TAB_REDIRECTS: Record<string, BillingAdminTabId> = {
  'billing-promotions': 'promotions',
}

export default function AdminBillingManagePage() {
  const { token, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const legacyRedirect = tabParam ? LEGACY_TAB_REDIRECTS[tabParam] : undefined
  const activeTab: BillingAdminTabId =
    legacyRedirect ??
    (BILLING_ADMIN_TABS.some((t) => t.id === tabParam) ? (tabParam as BillingAdminTabId) : 'plans')

  useEffect(() => {
    if (legacyRedirect) {
      setSearchParams({ tab: legacyRedirect }, { replace: true })
    }
  }, [legacyRedirect, setSearchParams])

  const [plans, setPlans] = useState<BillingPlanAdminRow[]>([])
  const [gaPlans, setGaPlans] = useState<GaBillingPlanAdminRow[]>([])
  const [billingUsers, setBillingUsers] = useState<BillingUserAdminRow[]>([])
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

  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [planFormMode, setPlanFormMode] = useState<'create' | 'edit'>('create')
  const [editingPlan, setEditingPlan] = useState<BillingPlanAdminRow | null>(null)
  const [planFormError, setPlanFormError] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<BillingPlanAdminRow | null>(null)
  const [deactivateBusy, setDeactivateBusy] = useState(false)

  const setTab = (tab: BillingAdminTabId) => {
    setSearchParams({ tab }, { replace: true })
  }

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setLoadError('')
    try {
      const [planRes, gaRes, userRes, referralRes, settingsRes] = await Promise.all([
        fetchAdminBillingPlans(token),
        fetchAdminGaBillingPlans(token),
        fetchAdminBillingUsers(token),
        fetchAdminReferralBillingPolicy(token),
        fetchAdminBillingSettings(token),
      ])
      setPlans(planRes.plans)
      setGaPlans(gaRes.gaPlans)
      setBillingUsers(userRes.users)
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

  const selectedPlanCodes = useMemo(() => {
    const codes = [
      ...Object.values(gaDrafts),
      ...Object.values(userDrafts),
      ...gaPlans.map((row) => row.defaultPlanCode ?? row.effectivePlanCode),
      ...billingUsers.map((row) => row.userOverridePlanCode ?? row.effectivePlanCode),
    ]
    return codes.filter(Boolean)
  }, [gaDrafts, userDrafts, gaPlans, billingUsers])

  const planOptions = useMemo(
    () => buildBillingPlanSelectOptions(plans, selectedPlanCodes),
    [plans, selectedPlanCodes],
  )

  const openCreatePlan = () => {
    setPlanFormMode('create')
    setEditingPlan(null)
    setPlanFormError('')
    setPlanFormOpen(true)
  }

  const openEditPlan = (plan: BillingPlanAdminRow) => {
    setPlanFormMode('edit')
    setEditingPlan(plan)
    setPlanFormError('')
    setPlanFormOpen(true)
  }

  const onSubmitPlanForm = async (values: BillingPlanFormValues) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setPlanFormError('')
    try {
      const payload = {
        code: values.code,
        name: values.name,
        supplyAmount: Number(values.supplyAmount),
        applyVat: values.applyVat,
        allowsReferralDiscount: values.allowsReferralDiscount,
        referralDiscountStartCount: values.allowsReferralDiscount
          ? Number(values.referralDiscountStartCount)
          : undefined,
        referralDiscountUnitSupplyAmount: values.allowsReferralDiscount
          ? Number(values.referralDiscountUnitSupplyAmount)
          : undefined,
        description: values.description.trim() || undefined,
        isActive: values.isActive,
      }
      if (planFormMode === 'create') {
        await createAdminBillingPlan(token, payload)
        setActionInfo('요금제가 추가되었습니다.')
      } else if (editingPlan) {
        await updateAdminBillingPlan(token, editingPlan.dbCode, {
          name: payload.name,
          supplyAmount: payload.supplyAmount,
          applyVat: payload.applyVat,
          allowsReferralDiscount: payload.allowsReferralDiscount,
          referralDiscountStartCount: payload.referralDiscountStartCount,
          referralDiscountUnitSupplyAmount: payload.referralDiscountUnitSupplyAmount,
          description: payload.description ?? null,
          isActive: payload.isActive,
        })
        setActionInfo('요금제가 수정되었습니다. 다음 invoice 생성부터 적용됩니다.')
      }
      setPlanFormOpen(false)
      await load()
    } catch (e) {
      setPlanFormError(e instanceof Error ? e.message : '요금제 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmDeactivatePlan = async () => {
    if (!token?.trim() || !deactivateTarget || deactivateBusy) return
    setDeactivateBusy(true)
    setActionError('')
    try {
      const result = await setAdminBillingPlanStatus(token, deactivateTarget.dbCode, false)
      setActionInfo(result.warning ?? '요금제가 비활성화되었습니다.')
      setDeactivateTarget(null)
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '비활성화에 실패했습니다.')
    } finally {
      setDeactivateBusy(false)
    }
  }

  const onActivatePlan = async (plan: BillingPlanAdminRow) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    try {
      await setAdminBillingPlanStatus(token, plan.dbCode, true)
      setActionInfo('요금제가 활성화되었습니다.')
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '활성화에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

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
    <AdminPageShell
      className="billing-admin-page"
      title="결제·구독 관리"
      description="요금제 · GA 설정 · 구독 · 청구 · 추천인 할인 · 결제 연동"
      tabs={BILLING_ADMIN_TABS}
      activeTabId={activeTab}
      onTabChange={(tabId) => setTab(tabId as BillingAdminTabId)}
    >
      {loadError ? <StatusMessage tone="error" message={loadError} /> : null}
      {actionInfo ? <StatusMessage message={actionInfo} /> : null}
      {actionError ? <StatusMessage tone="error" message={actionError} /> : null}

      <AdminTabPanel variant={BILLING_ADMIN_TAB_LAYOUT[activeTab]}>
        {activeTab === 'plans' ? (
          <AdminDataCard
            title="등록 요금제"
            actions={
              <FormButton htmlType="button" variant="primary" disabled={busy} onClick={openCreatePlan}>
                요금제 추가
              </FormButton>
            }
          >
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
                    <span>
                      {plan.isActive ? plan.displayPriceWithVatNote : '비활성'}
                    </span>
                  </div>
                  <p className="billing-page__invoice-sub">
                    {formatPricingBreakdown({
                      supplyAmount: plan.supplyAmount,
                      vatAmount: plan.vatAmount,
                      totalAmount: plan.totalAmount,
                    })}
                  </p>
                  <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
                    {formatReferralDiscountPolicySummary(plan)}
                  </p>
                  {plan.description ? (
                    <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">{plan.description}</p>
                  ) : null}
                  {(plan.gaUsageCount > 0 || plan.userUsageCount > 0) && !plan.isActive ? (
                    <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
                      사용 중 GA {plan.gaUsageCount} · 사용자 예외 {plan.userUsageCount}
                    </p>
                  ) : null}
                  <div className="billing-page__actions">
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openEditPlan(plan)}
                    >
                      수정
                    </FormButton>
                    {plan.isActive ? (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setDeactivateTarget(plan)}
                      >
                        비활성화
                      </FormButton>
                    ) : (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onActivatePlan(plan)}
                      >
                        활성화
                      </FormButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          </AdminDataCard>
        ) : null}

        {activeTab === 'ga-plans' ? (
          <AdminDataCard title="GA 기본 요금">
          <p className="status text-sm">
            GA 단위 기본 요금제를 지정합니다. 소속 사용자는 예외가 없으면 이 요금제를 상속합니다. 저장 후 다음
            invoice 생성부터 적용되며, 기존 청구서 금액은 변경되지 않습니다.
          </p>
          <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">{PRICING_PRIORITY_NOTE}</p>
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
          </AdminDataCard>
        ) : null}

        {activeTab === 'users' ? (
          <AdminDataCard title="사용자별 구독/예외">
          <p className="status text-sm">
            사용자별 현재 구독 상태와 예외 요금제를 관리합니다. 예외가 없으면 GA 기본 요금을 상속하며, 개별 예외가
            있으면 GA 기본보다 우선 적용됩니다.
          </p>
          <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">{PRICING_PRIORITY_NOTE}</p>
          <ul className="billing-page__invoice-list">
            {billingUsers.map((row) => (
              <li key={row.userId} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>{row.userName}</strong>
                  <span>{BILLING_STATUS_LABEL[row.subscriptionStatus] ?? row.subscriptionStatus}</span>
                </div>
                <p className="billing-page__invoice-sub">
                  GA {row.gaName} ({row.gaCode}) · GA 기본 {row.gaDefaultPlanCode ?? '—'} · 사용자 예외{' '}
                  {row.userOverridePlanCode ?? '없음 (GA 기본 상속)'}
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
          </AdminDataCard>
        ) : null}

        {activeTab === 'invoices' ? (
          <BillingPaymentsAdminSection
          token={token ?? ''}
          busy={busy}
          setBusy={setBusy}
          onInfo={(message) => {
            setActionInfo(message)
            setActionError('')
          }}
          onError={(message) => {
            setActionError(message)
            setActionInfo('')
          }}
        />
        ) : null}

        {activeTab === 'referral' ? (
          <AdminDataCard title="추천 할인 정책" className="billing-referral-policy-section">
            {referralPolicy ? (
              <dl className="billing-page__meta billing-referral-policy-section__meta">
                <dt>기본 월 공급가</dt>
                <dd>{formatWon(referralPolicy.baseMonthlySupplyAmount)}</dd>
                <dt>추천인 월 할인</dt>
                <dd>유료 추천 1명당 {formatWon(referralPolicy.referrerDiscountPerActiveReferral)}</dd>
                <dt>추천받은 가입자 혜택</dt>
                <dd>자동 할인 없음</dd>
                <dt>최대 추천 할인</dt>
                <dd>현재 요금제 공급가 한도</dd>
                <dt>기본 요금제 무료 기준</dt>
                <dd>
                  유료 추천 {Math.ceil(referralPolicy.baseMonthlySupplyAmount / referralPolicy.referrerDiscountPerActiveReferral)}명
                </dd>
                <dt>할인 적용 기준</dt>
                <dd>추천받은 사용자가 active_paid 상태일 때</dd>
              </dl>
            ) : null}
            <ul className="billing-page__policy-list billing-referral-policy-section__notes">
              <li>추천 할인은 추천한 사람에게만 적용됩니다.</li>
              <li>추천받은 가입자에게는 자동 할인이 제공되지 않습니다.</li>
              <li>추천받은 가입자는 결제 단계에서 별도 무료/할인 코드를 입력할 수 있습니다.</li>
              <li>추천받은 사용자가 실제 유료 결제를 완료한 경우에만 추천 할인 카운트에 포함됩니다.</li>
              <li>무료 이용 중, 결제 대기, 미납, 해지 사용자는 추천 할인 대상에 포함되지 않습니다.</li>
              <li>할인은 현재 요금제 공급가를 초과할 수 없으며, 초과분은 환급 또는 이월되지 않습니다.</li>
            </ul>
            {plans.filter((plan) => plan.allowsReferralDiscount !== false).length ? (
              <div className="billing-referral-policy-section__plans">
                <h3 className="billing-referral-policy-section__plans-title">요금제별 적용</h3>
                <ul className="billing-page__policy-list">
                  {plans
                    .filter((plan) => plan.allowsReferralDiscount !== false)
                    .map((plan) => {
                      const unit = plan.referralDiscountUnitSupplyAmount ?? referralPolicy?.referrerDiscountPerActiveReferral ?? 1000
                      const startCount = plan.referralDiscountStartCount ?? 1
                      const freeCount =
                        plan.freeReferralCount ??
                        (plan.supplyAmount > 0 && unit > 0
                          ? startCount + Math.ceil(plan.supplyAmount / unit) - 1
                          : null)
                      return (
                        <li key={plan.dbCode}>
                          <strong>{plan.label}</strong> ({formatWon(plan.supplyAmount)} 공급가)
                          {startCount > 1
                            ? ` · ${startCount}명 추천부터 할인 시작`
                            : ' · 1명째부터 할인 적용'}
                          {freeCount != null ? ` · ${freeCount}명 추천 시 무료` : null}
                          {startCount > 1 ? (
                            <span className="billing-referral-policy-section__plan-note">
                              {' '}
                              이 요금제는 {startCount}명 추천부터 할인이 시작됩니다. 유료 추천 1명당{' '}
                              {formatWon(unit)}씩 할인되며, 요금제 공급가 한도까지만 적용됩니다.
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                </ul>
              </div>
            ) : null}
          </AdminDataCard>
        ) : null}

        {activeTab === 'promotions' ? (
        <PromotionCodesAdminSection
          token={token ?? ''}
          busy={busy}
          setBusy={setBusy}
          onInfo={(message) => {
            setActionInfo(message)
            setActionError('')
          }}
          onError={(message) => {
            setActionError(message)
            setActionInfo('')
          }}
        />
        ) : null}

        {activeTab === 'payment' ? (
          <>
            <AdminDataCard title="결제 모드">
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
            </AdminDataCard>
            <AdminDataCard title="PG 키 (자동결제 API 개별연동)">
              <p className="status text-sm">
                TEST 모드는 virtual + test_ck_ / test_sk_ 만 허용합니다. 결제위젯 키(gck/gsk)는 사용할 수 없습니다.
                시크릿 키는 저장 후 다시 표시되지 않습니다.
              </p>
              <p className="status text-sm">
                클라이언트 키: {settings?.hasClientKey ? '설정됨' : '미설정'}
                {settings?.clientKeyMasked ? ` (${settings.clientKeyMasked})` : ''}
              </p>
              <p className="status text-sm">시크릿 키: {settings?.hasSecretKey ? '설정됨' : '미설정'}</p>
              <p className="status text-sm">웹훅 시크릿: {settings?.hasWebhookSecret ? '설정됨' : '미설정'}</p>
              <p className="status text-sm">
                암호화 키: {settings?.canStoreSecrets ? '서버 설정됨' : 'PAYMENT_SETTINGS_SECRET_KEY 미설정'}
              </p>
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
            </AdminDataCard>
          </>
        ) : null}
      </AdminTabPanel>

      <BillingPlanFormDialog
        open={planFormOpen}
        mode={planFormMode}
        initialPlan={editingPlan}
        busy={busy}
        error={planFormError}
        onClose={() => {
          if (busy) return
          setPlanFormOpen(false)
        }}
        onSubmit={onSubmitPlanForm}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="요금제 비활성화"
        message={
          deactivateTarget
            ? `이 요금제(${deactivateTarget.label})를 비활성화합니다. 이미 생성된 청구서는 변경되지 않으며, 다음 청구서부터 신규 선택이 제한됩니다.${
                deactivateTarget.gaUsageCount > 0 || deactivateTarget.userUsageCount > 0
                  ? ` (사용 중 GA ${deactivateTarget.gaUsageCount} · 사용자 예외 ${deactivateTarget.userUsageCount})`
                  : ''
              }`
            : ''
        }
        confirmLabel="비활성화"
        tone="danger"
        busy={deactivateBusy}
        onConfirm={() => void onConfirmDeactivatePlan()}
        onCancel={() => {
          if (deactivateBusy) return
          setDeactivateTarget(null)
        }}
      />
    </AdminPageShell>
  )
}

export function AdminBillingLegacyRedirect({ tab }: { tab: BillingAdminTabId }) {
  return <Navigate to={`/admin/billing/manage?tab=${tab}`} replace />
}
