import type { ChangeEvent, FormEvent } from 'react'
import { FormInput } from '../../../components/form'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  formClassName?: string
}

/**
 * 연계 고객 모달 공통 검색 필드 — FormInput + clear.
 * portal 에서도 동일 padding/focus 를 쓰도록 CSS 스코프에 의존한다.
 */
export function CustomerRelationSearchField({
  value,
  onChange,
  placeholder = '고객명 또는 휴대폰번호 검색',
  disabled = false,
  autoFocus = false,
  formClassName = 'customer-relations-modal__search-form',
}: Props) {
  const hasValue = value.trim().length > 0

  return (
    <form
      className={formClassName}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
      }}
    >
      <div className="customer-relations-modal__search-wrap">
        <FormInput
          type="search"
          className={`customer-relations-modal__search-input${
            hasValue ? ' customer-relations-modal__search-input--with-clear' : ''
          }`}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
        {hasValue ? (
          <button
            type="button"
            className="customer-relations-modal__search-clear"
            aria-label="검색어 지우기"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            ×
          </button>
        ) : null}
      </div>
    </form>
  )
}
