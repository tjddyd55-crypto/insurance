import { FormInput, FormSelect } from '../../../components/form'
import type { InsurerSite } from '../../insurer-sites/api/insurerSitesApi'
import type { ContractFormState, ContractInsurerCategory } from '../hooks/useCustomerPremiumPaymentsState'
import type { FormStateSetter } from './CardPaymentFormDialog'

const paymentDayOptions = [
  { value: '', label: '결제일 선택' },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: `매월 ${i + 1}일`,
  })),
]

type Props = {
  value: ContractFormState
  onChange: FormStateSetter<ContractFormState>
  cardOptions: Array<{ value: string; label: string }>
  insurerSites: InsurerSite[]
}

const insurerCategoryOptions = [
  { value: '', label: '보험 구분 선택' },
  { value: 'NON_LIFE', label: '손해보험' },
  { value: 'LIFE', label: '생명보험' },
  { value: 'OTHER', label: '기타 (직접 입력)' },
]

/** 수납 대상 추가/수정 필드 그리드 (상태 필드 없음) */
export function CollectionTargetForm({ value, onChange, cardOptions, insurerSites }: Props) {
  const siteCategory = value.insurerCategory === 'LIFE' ? 'life' : value.insurerCategory === 'NON_LIFE' ? 'non_life' : null
  const companyOptions = [
    { value: '', label: value.insurerCategory ? '보험사 선택' : '보험 구분을 먼저 선택' },
    ...insurerSites
      .filter((site) => site.category === siteCategory)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
      .map((site) => ({ value: String(site.id), label: site.name })),
  ]
  return (
    <>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">
          보험 구분
          <span className="premium-payments-required" aria-hidden="true">
            *
          </span>
        </span>
        <FormSelect
          data-testid="card-contract-insurer-category"
          value={value.insurerCategory}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              insurerCategory: e.target.value as ContractInsurerCategory,
              insuranceCompanyId: '',
            }))
          }
          options={insurerCategoryOptions}
          required
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">
          보험회사
          <span className="premium-payments-required" aria-hidden="true">
            *
          </span>
        </span>
        {value.insurerCategory === 'OTHER' ? (
          <FormInput
            data-testid="card-contract-insurer-text"
            value={value.insuranceCompany}
            onChange={(e) => onChange((prev) => ({ ...prev, insuranceCompany: e.target.value }))}
            placeholder="보험회사명 직접 입력"
            required
          />
        ) : (
          <FormSelect
            data-testid="card-contract-insurer-company"
            value={value.insuranceCompanyId}
            onChange={(e) => onChange((prev) => ({ ...prev, insuranceCompanyId: e.target.value }))}
            options={companyOptions}
            disabled={!value.insurerCategory}
            required
          />
        )}
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">증권번호</span>
        <FormInput
          value={value.policyNumber}
          onChange={(e) => onChange((prev) => ({ ...prev, policyNumber: e.target.value }))}
          placeholder="증권번호 입력"
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">상품명</span>
        <FormInput
          value={value.productName}
          onChange={(e) => onChange((prev) => ({ ...prev, productName: e.target.value }))}
          placeholder="상품명 입력"
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">보험료</span>
        <FormInput
          value={value.premiumAmount}
          onChange={(e) => onChange((prev) => ({ ...prev, premiumAmount: e.target.value }))}
          placeholder="숫자만 입력"
          inputMode="numeric"
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">결제일</span>
        <FormSelect
          value={value.paymentDay}
          onChange={(e) => onChange((prev) => ({ ...prev, paymentDay: e.target.value }))}
          options={paymentDayOptions}
        />
      </label>
      <label className="premium-payments-field">
        <span className="premium-payments-field__label">사용할 카드</span>
        <FormSelect
          value={value.paymentCardId}
          onChange={(e) => onChange((prev) => ({ ...prev, paymentCardId: e.target.value }))}
          options={[{ value: '', label: '연결 안 함' }, ...cardOptions]}
        />
      </label>
      <label className="premium-payments-field premium-payments-field--memo">
        <span className="premium-payments-field__label">메모</span>
        <textarea
          className="premium-payments-textarea"
          value={value.memo}
          onChange={(e) => onChange((prev) => ({ ...prev, memo: e.target.value }))}
          placeholder="메모를 입력하세요 (선택)"
          rows={3}
        />
      </label>
    </>
  )
}
