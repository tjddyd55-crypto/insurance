import { SMS_ENABLED_TEMPLATE_VARIABLES } from '../../utils/smsTemplateVariables'

type Props = {
  onInsert: (token: string) => void
  disabled?: boolean
}

export default function SmsVariableChips({ onInsert, disabled = false }: Props) {
  return (
    <div className="sms-composer__variables">
      <p className="sms-composer__variables-title">치환 변수</p>
      <div className="sms-composer__variable-chips">
        {SMS_ENABLED_TEMPLATE_VARIABLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="sms-composer__variable-chip"
            disabled={disabled}
            title={`${item.aligoLabel} 삽입`}
            onClick={() => onInsert(item.token)}
          >
            + {item.chipLabel}
          </button>
        ))}
      </div>
      <p className="sms-composer__variables-note">현재는 고객명 치환만 지원합니다.</p>
    </div>
  )
}
