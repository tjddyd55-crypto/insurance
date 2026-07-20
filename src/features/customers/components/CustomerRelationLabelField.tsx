import { FormInput, FormSelect } from '../../../components/form'
import {
  RELATIONSHIP_LABEL_EDIT_SELECT_OPTIONS,
  RELATIONSHIP_LABEL_MAX_LENGTH,
  RELATIONSHIP_LABEL_SELECT_OPTIONS,
  isEtcRelationshipOption,
} from '../utils/relationshipLabel.js'

type Props = {
  option: string
  custom: string
  onOptionChange: (option: string) => void
  onCustomChange: (custom: string) => void
  /** true 이면 「본인」 옵션 포함 (관계 수정) */
  includeSelf?: boolean
  disabled?: boolean
  selectLabel?: string
}

/**
 * 관계 select + 기타 선택 시 직접 입력.
 * create / add-member / edit-label 공용.
 */
export function CustomerRelationLabelField({
  option,
  custom,
  onOptionChange,
  onCustomChange,
  includeSelf = false,
  disabled = false,
  selectLabel = '관계',
}: Props) {
  const options = includeSelf ? RELATIONSHIP_LABEL_EDIT_SELECT_OPTIONS : RELATIONSHIP_LABEL_SELECT_OPTIONS
  const showCustom = isEtcRelationshipOption(option)

  return (
    <div className="customer-relation-label-field">
      <label className="customer-relation-group-form__field">
        <span>{selectLabel}</span>
        <FormSelect
          value={option}
          disabled={disabled}
          onChange={(e) => onOptionChange(e.target.value)}
          options={options}
        />
      </label>
      {showCustom ? (
        <label className="customer-relation-group-form__field customer-relation-label-field__custom">
          <span>관계 직접 입력</span>
          <FormInput
            className="customer-relation-group-form__custom-label"
            placeholder="관계를 입력해 주세요."
            value={custom}
            maxLength={RELATIONSHIP_LABEL_MAX_LENGTH}
            disabled={disabled}
            onChange={(e) => onCustomChange(e.target.value)}
            autoComplete="off"
          />
        </label>
      ) : null}
    </div>
  )
}
