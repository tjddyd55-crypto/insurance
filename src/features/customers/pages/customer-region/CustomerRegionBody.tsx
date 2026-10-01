import { FormButton, FormInput, FormSelect } from '../../../../components/form'
import {
  isEupmyeondongFilterEnabled,
  isSigunguFilterEnabled,
  regionSelectOptions,
} from '../../domain/regionFilterState'
import type { CustomerRegionViewProps } from '../../hooks/useCustomerRegionState'
import CustomerMapModeTabs from '../customer-map/CustomerMapModeTabs'

const SORT_OPTIONS = [
  { value: 'name', label: '이름순' },
  { value: 'created', label: '최근 등록순' },
  { value: 'consult', label: '최근 상담순' },
]

export default function CustomerRegionBody(props: CustomerRegionViewProps) {
  const sigunguEnabled = isSigunguFilterEnabled(props.sido)
  const eupEnabled = isEupmyeondongFilterEnabled(
    props.sido,
    props.sigungu,
    props.options.sigungu.length,
  )

  return (
    <>
      <CustomerMapModeTabs />
      <div className="customer-region-page__filters">
        <label>
          <span>시/도</span>
          <FormSelect
            aria-label="시/도"
            value={props.sido}
            options={regionSelectOptions(props.options.sido)}
            onChange={(event) => props.onSidoChange(event.target.value)}
          />
        </label>
        <label>
          <span>시/군/구</span>
          <FormSelect
            aria-label="시/군/구"
            value={props.sigungu}
            disabled={!sigunguEnabled}
            options={regionSelectOptions(sigunguEnabled ? props.options.sigungu : [])}
            onChange={(event) => props.onSigunguChange(event.target.value)}
          />
        </label>
        <label>
          <span>읍/면/동</span>
          <FormSelect
            aria-label="읍/면/동"
            value={props.eupmyeondong}
            disabled={!eupEnabled}
            options={regionSelectOptions(eupEnabled ? props.options.eupmyeondong : [])}
            onChange={(event) => props.onEupChange(event.target.value)}
          />
        </label>
        <label>
          <span>검색</span>
          <FormInput
            type="search"
            aria-label="이름 전화 주소 검색"
            value={props.query}
            placeholder="이름, 전화번호, 주소"
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </label>
        <label>
          <span>정렬</span>
          <FormSelect
            aria-label="정렬"
            value={props.sort}
            options={SORT_OPTIONS}
            onChange={(event) => props.onSortChange(event.target.value as CustomerRegionViewProps['sort'])}
          />
        </label>
      </div>
      {props.error ? <p className="customer-region-page__error">{props.error}</p> : null}
      {props.loading ? <p className="customer-region-page__status">고객을 불러오는 중…</p> : null}
      {!props.loading && props.customers.length === 0 ? (
        <p className="customer-region-page__status">조건에 맞는 고객이 없습니다.</p>
      ) : null}
      <ul className="customer-region-page__list">
        {props.customers.map((customer) => (
          <li key={customer.id}>
            <FormButton
              htmlType="button"
              variant="secondary"
              className="customer-region-page__row"
              onClick={() => props.onOpenCustomer(customer.id)}
            >
              <span className="customer-region-page__name">{customer.name}</span>
              <span>{customer.phone || '전화번호 없음'}</span>
              <span>{customer.address || '주소 없음'}</span>
              <span>{customer.assigneeName || '담당자 없음'}</span>
              <span>{customer.labels || '라벨 없음'}</span>
            </FormButton>
          </li>
        ))}
      </ul>
    </>
  )
}
