import AppDateInput, { type AppDateInputProps } from '../../../components/common/AppDateInput'
import { getKoreanWeekdayLabel } from '../../../utils/formatDateWithKoreanWeekday'
import { isValidDateString } from '../../../utils/dateInput'

/**
 * 상담 이력 탭 전용 — AppDateInput value는 YYYY-MM-DD 유지, 옆에 요일만 보조 표시.
 * 전역 AppDateInput 계약은 변경하지 않는다.
 */
export default function CustomerConsultationDateInput({
  value,
  wrapperClassName = '',
  ...props
}: AppDateInputProps) {
  const weekday = isValidDateString(String(value ?? '').trim())
    ? getKoreanWeekdayLabel(value)
    : ''

  return (
    <div
      className={[
        'customer-consultations-date-with-weekday',
        weekday ? 'customer-consultations-date-with-weekday--has-weekday' : '',
        wrapperClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AppDateInput value={value} {...props} />
      {weekday ? (
        <span className="customer-consultations-date-with-weekday__weekday" aria-hidden="true">
          ({weekday})
        </span>
      ) : null}
    </div>
  )
}
