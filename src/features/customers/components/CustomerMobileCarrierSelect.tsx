import { FormSelect } from '../../../components/form'
import {
  CUSTOMER_MOBILE_CARRIER_FORM_OPTIONS,
  CUSTOMER_MOBILE_CARRIER_PLACEHOLDER,
} from '../config/customerMobileCarrier.config'

type CustomerMobileCarrierSelectProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
  id?: string
  className?: string
}

/** 고객 등록·수정 — 통신사(select) */
export default function CustomerMobileCarrierSelect({
  value,
  onChange,
  disabled = false,
  name = 'customer-carrier',
  id,
  className = 'field__control',
}: CustomerMobileCarrierSelectProps) {
  return (
    <FormSelect
      id={id}
      name={name}
      className={className}
      value={value}
      disabled={disabled}
      options={CUSTOMER_MOBILE_CARRIER_FORM_OPTIONS}
      aria-label={CUSTOMER_MOBILE_CARRIER_PLACEHOLDER}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
