import { useCallback, useEffect, useMemo, useState } from 'react'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import {
  PROMOTION_CODE_TYPE_LABEL,
  PROMOTION_DISCOUNT_TYPE_LABEL,
  PROMOTION_OWNER_TYPE_LABEL,
  createAdminPromotionCode,
  disableAdminPromotionCode,
  fetchAdminPromotionCodeStats,
  fetchAdminPromotionCodes,
  updateAdminPromotionCode,
  type PromotionCodeAdminRow,
  type PromotionCodeFormInput,
  type PromotionCodeStatsResponse,
  type PromotionCodeType,
  type PromotionDiscountType,
  type PromotionOwnerType,
} from '../../promotions/promotionApi'
import { formatWon } from '../api/billingApi'

const CODE_TYPE_OPTIONS = (Object.keys(PROMOTION_CODE_TYPE_LABEL) as PromotionCodeType[]).map((value) => ({
  value,
  label: PROMOTION_CODE_TYPE_LABEL[value],
}))

const DISCOUNT_TYPE_OPTIONS = (Object.keys(PROMOTION_DISCOUNT_TYPE_LABEL) as PromotionDiscountType[]).map(
  (value) => ({
    value,
    label: PROMOTION_DISCOUNT_TYPE_LABEL[value],
  }),
)

const OWNER_TYPE_OPTIONS = (Object.keys(PROMOTION_OWNER_TYPE_LABEL) as PromotionOwnerType[]).map((value) => ({
  value,
  label: PROMOTION_OWNER_TYPE_LABEL[value],
}))

const EMPTY_FORM: PromotionCodeFormInput = {
  code: '',
  codeType: 'discount',
  discountType: 'first_month_fixed',
  discountAmount: 2000,
  discountPercent: null,
  durationMonths: null,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  perAccountLimit: 1,
  ownerName: '',
  ownerType: 'normal',
  memo: '',
  isActive: true,
}

type Props = {
  token: string
  busy: boolean
  setBusy: (busy: boolean) => void
  onInfo: (message: string) => void
  onError: (message: string) => void
}

function needsAmount(discountType: PromotionDiscountType) {
  return discountType.endsWith('_fixed')
}

function needsPercent(discountType: PromotionDiscountType) {
  return discountType.endsWith('_percent')
}

function needsDuration(discountType: PromotionDiscountType) {
  return discountType.startsWith('recurring_')
}

function toFormValues(row: PromotionCodeAdminRow): PromotionCodeFormInput {
  return {
    code: row.code,
    codeType: row.codeType,
    discountType: row.discountType,
    discountAmount: row.discountAmount,
    discountPercent: row.discountPercent,
    durationMonths: row.durationMonths,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    maxUses: row.maxUses,
    perAccountLimit: row.perAccountLimit,
    ownerName: row.ownerName ?? '',
    ownerType: row.ownerType,
    memo: row.memo ?? '',
    isActive: row.isActive,
  }
}

export default function PromotionCodesAdminSection({ token, busy, setBusy, onInfo, onError }: Props) {
  const [codes, setCodes] = useState<PromotionCodeAdminRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<PromotionCodeFormInput>(EMPTY_FORM)
  const [statsTarget, setStatsTarget] = useState<PromotionCodeStatsResponse | null>(null)

  const load = useCallback(async () => {
    if (!token.trim()) return
    setLoadError('')
    try {
      const res = await fetchAdminPromotionCodes(token)
      setCodes(res.codes)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '프로모션 코드 목록을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setFormMode('create')
    setEditingId(null)
    setFormValues(EMPTY_FORM)
  }

  const openEdit = (row: PromotionCodeAdminRow) => {
    setFormMode('edit')
    setEditingId(row.id)
    setFormValues(toFormValues(row))
  }

  const onSubmit = async () => {
    if (!token.trim() || busy) return
    setBusy(true)
    onError('')
    try {
      const payload: PromotionCodeFormInput = {
        ...formValues,
        code: formValues.code.trim().toUpperCase(),
        ownerName: formValues.ownerName?.trim() || null,
        memo: formValues.memo?.trim() || null,
        discountAmount: needsAmount(formValues.discountType) ? Number(formValues.discountAmount) : null,
        discountPercent: needsPercent(formValues.discountType) ? Number(formValues.discountPercent) : null,
        durationMonths: needsDuration(formValues.discountType) ? Number(formValues.durationMonths) : null,
      }
      if (formMode === 'create') {
        await createAdminPromotionCode(token, payload)
        onInfo('프로모션 코드가 생성되었습니다.')
      } else if (editingId != null) {
        await updateAdminPromotionCode(token, editingId, payload)
        onInfo('프로모션 코드가 수정되었습니다.')
      }
      openCreate()
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onDisable = async (row: PromotionCodeAdminRow) => {
    if (!token.trim() || busy || !row.isActive) return
    setBusy(true)
    onError('')
    try {
      await disableAdminPromotionCode(token, row.id)
      onInfo(`코드 ${row.code} 가 비활성화되었습니다.`)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : '비활성화에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onShowStats = async (row: PromotionCodeAdminRow) => {
    if (!token.trim() || busy) return
    setBusy(true)
    onError('')
    try {
      const stats = await fetchAdminPromotionCodeStats(token, row.id)
      setStatsTarget(stats)
    } catch (e) {
      onError(e instanceof Error ? e.message : '통계를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const discountPreview = useMemo(() => {
    const dt = formValues.discountType
    if (dt === 'first_month_free') return '첫 달 무료'
    if (needsAmount(dt) && formValues.discountAmount) {
      return `${formatWon(Number(formValues.discountAmount))} 공급가 할인`
    }
    if (needsPercent(dt) && formValues.discountPercent) {
      return `${formValues.discountPercent}% 할인`
    }
    return ''
  }, [formValues.discountAmount, formValues.discountPercent, formValues.discountType])

  return (
    <div className="promotion-code-panel">
      <section className="card auth-card billing-page__card promotion-code-card">
        <div className="promotion-code-card-header billing-page__section-head">
          <h2 className="billing-page__section-title">프로모션 코드</h2>
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={openCreate}>
            새 코드
          </FormButton>
        </div>
        <p className="billing-page__invoice-sub billing-page__invoice-sub--muted">
          기존 일반 추천코드(legacy)는 그대로 유지됩니다. 프로모션 코드가 우선 검증됩니다.
        </p>
        {loadError ? <StatusMessage tone="error" message={loadError} /> : null}
        {codes.length === 0 ? (
          <p className="status text-sm">등록된 프로모션 코드가 없습니다.</p>
        ) : (
          <ul className="billing-page__invoice-list">
            {codes.map((row) => (
              <li key={row.id} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>
                    {row.code} · {PROMOTION_DISCOUNT_TYPE_LABEL[row.discountType]}
                  </strong>
                  <span>{row.isActive ? '활성' : '비활성'}</span>
                </div>
                <p className="billing-page__invoice-sub">
                  {PROMOTION_CODE_TYPE_LABEL[row.codeType]} · 사용 {row.usedCount}
                  {row.maxUses != null ? ` / ${row.maxUses}` : ''}
                  {row.ownerName ? ` · ${row.ownerName}` : ''}
                </p>
                <div className="billing-page__actions">
                  <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => openEdit(row)}>
                    수정
                  </FormButton>
                  <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => void onShowStats(row)}>
                    통계
                  </FormButton>
                  {row.isActive ? (
                    <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => void onDisable(row)}>
                      비활성화
                    </FormButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card auth-card billing-page__card promotion-code-card">
        <h2 className="billing-page__section-title">{formMode === 'create' ? '코드 생성' : '코드 수정'}</h2>
        <div className="promotion-code-form-grid">
          <FieldWrapper label="코드" className="promotion-code-field">
            <FormInput
              value={formValues.code}
              onChange={(e) => setFormValues((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="예: WELCOME2026"
            />
          </FieldWrapper>
          <FieldWrapper label="코드 유형" className="promotion-code-field">
            <FormSelect
              value={formValues.codeType}
              options={CODE_TYPE_OPTIONS}
              onChange={(e) => setFormValues((prev) => ({ ...prev, codeType: e.target.value as PromotionCodeType }))}
            />
          </FieldWrapper>
          <FieldWrapper label="할인 유형" className="promotion-code-field">
            <FormSelect
              value={formValues.discountType}
              options={DISCOUNT_TYPE_OPTIONS}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  discountType: e.target.value as PromotionDiscountType,
                }))
              }
            />
          </FieldWrapper>
          {needsAmount(formValues.discountType) ? (
            <FieldWrapper label="할인 금액(공급가)" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                value={formValues.discountAmount ?? ''}
                onChange={(e) => setFormValues((prev) => ({ ...prev, discountAmount: Number(e.target.value) }))}
              />
            </FieldWrapper>
          ) : null}
          {needsPercent(formValues.discountType) ? (
            <FieldWrapper label="할인율(%)" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                value={formValues.discountPercent ?? ''}
                onChange={(e) => setFormValues((prev) => ({ ...prev, discountPercent: Number(e.target.value) }))}
              />
            </FieldWrapper>
          ) : null}
          {needsDuration(formValues.discountType) ? (
            <FieldWrapper label="적용 개월 수" className="promotion-code-field">
              <FormInput
                inputMode="numeric"
                value={formValues.durationMonths ?? ''}
                onChange={(e) => setFormValues((prev) => ({ ...prev, durationMonths: Number(e.target.value) }))}
              />
            </FieldWrapper>
          ) : null}
          <FieldWrapper label="최대 사용 횟수 (비우면 무제한)" className="promotion-code-field">
            <FormInput
              inputMode="numeric"
              value={formValues.maxUses ?? ''}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  maxUses: e.target.value.trim() === '' ? null : Number(e.target.value),
                }))
              }
            />
          </FieldWrapper>
          <FieldWrapper label="소유자 유형" className="promotion-code-field">
            <FormSelect
              value={formValues.ownerType}
              options={OWNER_TYPE_OPTIONS}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, ownerType: e.target.value as PromotionOwnerType }))
              }
            />
          </FieldWrapper>
          <FieldWrapper label="소유자/채널명" className="promotion-code-field">
            <FormInput
              value={formValues.ownerName ?? ''}
              onChange={(e) => setFormValues((prev) => ({ ...prev, ownerName: e.target.value }))}
            />
          </FieldWrapper>
          <FieldWrapper label="메모" className="promotion-code-field promotion-code-field--full">
            <FormInput value={formValues.memo ?? ''} onChange={(e) => setFormValues((prev) => ({ ...prev, memo: e.target.value }))} />
          </FieldWrapper>
          {discountPreview ? (
            <p className="promotion-code-preview promotion-code-field--full status">{discountPreview}</p>
          ) : null}
          <div className="promotion-code-actions promotion-code-field--full">
            <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void onSubmit()}>
              {formMode === 'create' ? '생성' : '저장'}
            </FormButton>
          </div>
        </div>
      </section>

      {statsTarget ? (
        <section className="card auth-card billing-page__card promotion-code-card">
          <h2 className="billing-page__section-title">통계 · {statsTarget.promotion.code}</h2>
          <dl className="billing-page__meta">
            <dt>적용 계정</dt>
            <dd>{statsTarget.accountCount}명</dd>
            <dt>청구 할인 적용</dt>
            <dd>{statsTarget.redemptionCount}건</dd>
            <dt>누적 할인(공급가)</dt>
            <dd>{formatWon(statsTarget.totalDiscountAmount)}</dd>
          </dl>
          {statsTarget.recentRedemptions.length > 0 ? (
            <ul className="billing-page__policy-list">
              {statsTarget.recentRedemptions.map((row) => (
                <li key={row.id}>
                  {row.userName ?? row.userId} · 할인 {formatWon(row.discountAmount)} ·{' '}
                  {row.createdAt ?? ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="status text-sm">사용 내역이 없습니다.</p>
          )}
          <FormButton htmlType="button" variant="secondary" onClick={() => setStatsTarget(null)}>
            닫기
          </FormButton>
        </section>
      ) : null}
    </div>
  )
}
