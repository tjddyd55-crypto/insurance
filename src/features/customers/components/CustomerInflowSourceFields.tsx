import { FormInput, FormSelect } from '../../../components/form'
import {
  CUSTOMER_INFLOW_SOURCE_FORM_OPTIONS,
  getInflowSourceDetailFieldMeta,
  requiresInflowSourceDetail,
} from '../config/customerInflowSource.config'

type CustomerInflowSourceFieldsProps = {
  inflowSource: string
  referrerName: string
  onInflowSourceChange: (value: string) => void
  onReferrerNameChange: (value: string) => void
}

export default function CustomerInflowSourceFields({
  inflowSource,
  referrerName,
  onInflowSourceChange,
  onReferrerNameChange,
}: CustomerInflowSourceFieldsProps) {
  const showDetail = requiresInflowSourceDetail(inflowSource)
  const detailMeta = getInflowSourceDetailFieldMeta(inflowSource)

  return (
    <div className="customer-inflow-fields">
      <label className="field">
        <span className="field__label">유입 경로</span>
        <FormSelect
          className="field__control"
          value={inflowSource}
          onChange={(event) => onInflowSourceChange(event.target.value)}
          options={CUSTOMER_INFLOW_SOURCE_FORM_OPTIONS}
        />
      </label>
      {showDetail && detailMeta ? (
        <label className="field">
          <span className="field__label">{detailMeta.label}</span>
          <FormInput
            className="field__control"
            placeholder={detailMeta.placeholder}
            value={referrerName}
            onChange={(event) => onReferrerNameChange(event.target.value)}
          />
        </label>
      ) : null}
    </div>
  )
}
