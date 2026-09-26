import FormInput from '../../../../components/form/FormInput'

import { FormField } from './FormField'

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  proposed?: boolean
}

export function AmountInputField({ id, label, value, onChange, proposed = false }: Props) {
  return (
    <FormField label={label} htmlFor={id}>
      <div
        className={[
          'cs-form-primitive__amount-row',
          proposed ? 'cs-form-primitive__amount-row--proposed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <FormInput
          id={id}
          inputMode="numeric"
          value={value}
          className="cs-form-primitive__amount-input"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="cs-form-primitive__amount-unit">만원</span>
      </div>
    </FormField>
  )
}
