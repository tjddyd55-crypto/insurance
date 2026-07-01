import type { TaCallAssignment, TaCallDay, TaCallStatus } from '../types/taCall.types'
import { TA_STATUS_LABELS } from '../types/taCall.types'
import {
  buildTelHref,
  formatTaCallBirthDate,
  formatTaCallGender,
  formatTaCallPhoneNumber,
  formatTaDayHeaderCompact,
  resolveDayEmptyMessage,
  resolveDayHeaderRatio,
  resolveDayStatusBadge,
} from '../utils/taCallDisplay'

type TaCallStatusButtonsProps = {
  current: TaCallStatus
  disabled?: boolean
  layout: 'mobile' | 'pc'
  onChange: (status: TaCallStatus) => void
}

function TaCallStatusButtons({ current, disabled, layout, onChange }: TaCallStatusButtonsProps) {
  const statuses: TaCallStatus[] = ['not_called', 'completed', 'no_answer']
  return (
    <div className={`ta-call-status-buttons ta-call-status-buttons--${layout}`}>
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          className={`ta-call-status-buttons__btn ta-call-status-buttons__btn--${status}${
            current === status ? ' ta-call-status-buttons__btn--active' : ''
          }`}
          disabled={disabled}
          onClick={() => onChange(status)}
        >
          {TA_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  )
}

type TaCallAssignmentCardProps = {
  assignment: TaCallAssignment
  emphasize?: boolean
  disabled?: boolean
  onStatusChange: (status: TaCallStatus) => void
}

export function TaCallAssignmentCard({
  assignment,
  emphasize = false,
  disabled,
  onStatusChange,
}: TaCallAssignmentCardProps) {
  const tel = buildTelHref(assignment.customerPhone)
  const gender = formatTaCallGender(assignment.customerGender)
  const birthDate = formatTaCallBirthDate(assignment.customerBirthDate)
  const phone = formatTaCallPhoneNumber(assignment.customerPhone)

  return (
    <article
      className={`ta-call-assignment-card${emphasize ? ' ta-call-assignment-card--today' : ''}`}
    >
      <div className="ta-call-assignment-card__head">
        <div className="ta-call-assignment-card__name-row">
          <strong className="ta-call-assignment-card__name">{assignment.customerName}</strong>
          <span className="ta-call-assignment-card__gender">{gender}</span>
          <span className={`ta-call-status-badge ta-call-status-badge--${assignment.status}`}>
            {TA_STATUS_LABELS[assignment.status]}
          </span>
        </div>
        {tel ? (
          <a className="ta-call-assignment-card__call-btn" href={tel} aria-label={`${assignment.customerName}에게 전화`}>
            📞
          </a>
        ) : null}
      </div>
      <div className="ta-call-assignment-card__meta">
        <span className="ta-call-assignment-card__meta-item">생년월일 {birthDate}</span>
        <span className="ta-call-assignment-card__meta-item">연락처 {phone}</span>
      </div>
      <TaCallStatusButtons
        current={assignment.status}
        disabled={disabled}
        layout="mobile"
        onChange={onStatusChange}
      />
    </article>
  )
}

type TaCallAssignmentRowProps = {
  assignment: TaCallAssignment
  disabled?: boolean
  onStatusChange: (status: TaCallStatus) => void
}

export function TaCallAssignmentRow({ assignment, disabled, onStatusChange }: TaCallAssignmentRowProps) {
  const tel = buildTelHref(assignment.customerPhone)
  return (
    <div className="ta-call-assignment-row">
      <div className="ta-call-assignment-row__name">{assignment.customerName}</div>
      <div className="ta-call-assignment-row__gender">{formatTaCallGender(assignment.customerGender)}</div>
      <div className="ta-call-assignment-row__birth">{formatTaCallBirthDate(assignment.customerBirthDate)}</div>
      <div className="ta-call-assignment-row__phone">{formatTaCallPhoneNumber(assignment.customerPhone)}</div>
      <div className="ta-call-assignment-row__status">
        <span className={`ta-call-status-badge ta-call-status-badge--${assignment.status}`}>
          {TA_STATUS_LABELS[assignment.status]}
        </span>
      </div>
      <div className="ta-call-assignment-row__status-actions">
        <TaCallStatusButtons
          current={assignment.status}
          disabled={disabled}
          layout="pc"
          onChange={onStatusChange}
        />
      </div>
      <div className="ta-call-assignment-row__call">
        {tel ? (
          <a className="ta-call-assignment-row__call-btn" href={tel} aria-label={`${assignment.customerName}에게 전화`}>
            📞
          </a>
        ) : (
          <span className="ta-call-assignment-row__call-empty">-</span>
        )}
      </div>
    </div>
  )
}

type TaCallDaySectionProps = {
  day: TaCallDay
  busy: boolean
  expanded: boolean
  layout: 'mobile' | 'pc'
  onToggleExpanded: () => void
  onStatusChange: (assignmentId: string, status: TaCallStatus) => void
}

export default function TaCallDaySection({
  day,
  busy,
  expanded,
  layout,
  onToggleExpanded,
  onStatusChange,
}: TaCallDaySectionProps) {
  const badge = resolveDayStatusBadge(day)
  const emptyMessage = resolveDayEmptyMessage(day)
  const ratio = resolveDayHeaderRatio(day)
  const { dateLabel, weekday } = formatTaDayHeaderCompact(day.date)
  const showAssignmentList = expanded && !day.isFuture && day.totalCount > 0
  const showEmptyBody = expanded && (day.isFuture || day.totalCount === 0)

  return (
    <section
      className={`ta-call-day-section${
        day.isToday ? ' ta-call-day-section--today' : ''
      }${day.isFuture ? ' ta-call-day-section--future' : ''}${
        day.isMissionCompleted ? ' ta-call-day-section--completed' : ''
      }${expanded ? ' ta-call-day-section--expanded' : ' ta-call-day-section--collapsed'}`}
    >
      <button
        type="button"
        className="ta-call-day-section__header"
        aria-expanded={expanded}
        onClick={onToggleExpanded}
      >
        <span className="ta-call-day-section__toggle" aria-hidden>
          {expanded ? '▼' : '▶'}
        </span>
        <div className="ta-call-day-section__date">
          <span className="ta-call-day-section__date-label">{dateLabel}</span>
          <span className="ta-call-day-section__weekday">{weekday}</span>
        </div>
        <div className="ta-call-day-section__summary">
          {!day.isFuture ? <span className="ta-call-day-section__ratio">{ratio}</span> : null}
          <span className={`ta-call-day-section__badge ta-call-day-section__badge--${badge.replace(/\s+/g, '-')}`}>
            {badge}
          </span>
        </div>
        {layout === 'pc' && expanded && !day.isFuture && day.totalCount > 0 ? (
          <div className="ta-call-day-section__stats">
            통화완료 {day.completedCount}, 부재중 {day.noAnswerCount}, 미통화 {day.notCalledCount} | {ratio}
          </div>
        ) : null}
      </button>

      {showEmptyBody ? <p className="ta-call-day-section__empty">{emptyMessage}</p> : null}

      {showAssignmentList && layout === 'pc' ? (
        <div className="ta-call-day-section__table">
          <div className="ta-call-assignment-row ta-call-assignment-row--head">
            <div>고객명</div>
            <div>성별</div>
            <div>생년월일</div>
            <div>연락처</div>
            <div>현재 상태</div>
            <div>상태 변경</div>
            <div>전화</div>
          </div>
          {day.assignments.map((assignment) => (
            <TaCallAssignmentRow
              key={assignment.id}
              assignment={assignment}
              disabled={busy}
              onStatusChange={(status) => onStatusChange(assignment.id, status)}
            />
          ))}
        </div>
      ) : null}

      {showAssignmentList && layout === 'mobile' ? (
        <div className="ta-call-day-section__cards">
          {day.assignments.map((assignment) => (
            <TaCallAssignmentCard
              key={assignment.id}
              assignment={assignment}
              emphasize={day.isToday}
              disabled={busy}
              onStatusChange={(status) => onStatusChange(assignment.id, status)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
