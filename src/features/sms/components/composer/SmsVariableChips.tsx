import { SMS_TEMPLATE_VARIABLES } from '../../utils/smsTemplateVariables'

type Props = {
  onInsert: (token: string) => void
  disabled?: boolean
}

export default function SmsVariableChips({ onInsert, disabled = false }: Props) {
  return (
    <div className="sms-composer__variables">
      <p className="sms-composer__variables-title">치환 변수</p>
      <div className="sms-composer__variable-chips">
        {SMS_TEMPLATE_VARIABLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="sms-composer__variable-chip"
            disabled={disabled || !item.enabled}
            title={item.enabled ? `${item.aligoLabel} 삽입` : item.disabledReason}
            onClick={() => onInsert(item.token)}
          >
            + {item.chipLabel}
          </button>
        ))}
      </div>
      <p className="sms-composer__variables-note">
        치환 변수는 실제 발송 시 고객별 값으로 변경됩니다. 미리보기는 샘플 고객 기준입니다.
      </p>
    </div>
  )
}
