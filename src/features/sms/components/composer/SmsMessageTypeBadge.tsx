import type { SmsTransportType } from '../../utils/smsMessageMeta'

type Props = {
  activeType: SmsTransportType
  pulse?: boolean
  compact?: boolean
}

const ITEMS: Array<{ id: SmsTransportType; short: string; label: string; icon: string }> = [
  { id: 'SMS', short: 'SMS', label: '단문', icon: '💬' },
  { id: 'LMS', short: 'LMS', label: '장문', icon: '📄' },
  { id: 'MMS', short: 'MMS', label: '그림', icon: '🖼' },
]

export default function SmsMessageTypeBadge({ activeType, pulse = false, compact = false }: Props) {
  return (
    <div
      className={`sms-composer__type-badges${compact ? ' sms-composer__type-badges--compact' : ''}${pulse ? ' sms-composer__type-badges--pulse' : ''}`}
      aria-label="발송 유형"
    >
      {ITEMS.map((item) => (
        <span
          key={item.id}
          className={`sms-composer__type-badge sms-composer__type-badge--${item.id.toLowerCase()}${
            activeType === item.id ? ' sms-composer__type-badge--active' : ''
          }`}
        >
          <span className="sms-composer__type-badge-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="sms-composer__type-badge-short">{item.short}</span>
          <span className="sms-composer__type-badge-label">{item.label}</span>
        </span>
      ))}
    </div>
  )
}
