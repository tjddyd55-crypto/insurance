import type { TaCallAssignment, TaCallDay, TaCallStatus } from '../types/taCall.types'
import { TA_STATUS_LABELS } from '../types/taCall.types'
import {
  buildTelHref,
  formatTaBirthDateDots,
  genderSymbol,
  resolveDayEmptyMessage,
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
  const gender = genderSymbol(assignment.customerGender)

  return (
    <article
      className={`ta-call-assignment-card${emphasize ? ' ta-call-assignment-card--today' : ''}`}
    >
      <div className="ta-call-assignment-card__head">
        <div className="ta-call-assignment-card__name-row">
          <strong className="ta-call-assignment-card__name">{assignment.customerName}</strong>
          {gender ? (
            <span className={`ta-call-assignment-card__gender ta-call-assignment-card__gender--${gender.toLowerCase()}`}>
              {gender}
            </span>
          ) : null}
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
        <span>{formatTaBirthDateDots(assignment.customerBirthDate)}</span>
        <span>{assignment.customerPhone}</span>
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
      <div className="ta-call-assignment-row__birth">{formatTaBirthDateDots(assignment.customerBirthDate)}</div>
      <div className="ta-call-assignment-row__phone">{assignment.customerPhone}</div>
      <div className="ta-call-assignment-row__status">
        <span className={`ta-call-status-badge ta-call-status-badge--${assignment.status}`}>
          {TA_STATUS_LABELS[assignment.status]}
        </span>
      </div>
      <div className="ta-call-assignment-row__actions">
        <TaCallStatusButtons
          current={assignment.status}
          disabled={disabled}
          layout="pc"
          onChange={onStatusChange}
        />
        {tel ? (
          <a className="ta-call-assignment-row__call-btn" href={tel} aria-label={`${assignment.customerName}에게 전화`}>
            📞
          </a>
        ) : null}
      </div>
    </div>
  )
}

type TaCallDaySectionProps = {
  day: TaCallDay
  busy: boolean
  layout: 'mobile' | 'pc'
  onStatusChange: (assignmentId: string, status: TaCallStatus) => void
}

export default function TaCallDaySection({ day, busy, layout, onStatusChange }: TaCallDaySectionProps) {
  const badge = resolveDayStatusBadge(day)
  const emptyMessage = resolveDayEmptyMessage(day)
  const ratio = day.totalCount > 0 ? `${day.completedCount}/${day.totalCount}` : `0/${day.dailyTargetCount}`

  return (
    <section
      className={`ta-call-day-section${
        day.isToday ? ' ta-call-day-section--today' : ''
      }${day.isFuture ? ' ta-call-day-section--future' : ''}${
        day.isMissionCompleted ? ' ta-call-day-section--completed' : ''
      }`}
    >
      <header className="ta-call-day-section__header">
        <div className="ta-call-day-section__date">
          <span className="ta-call-day-section__day-num">{day.date.slice(8, 10).replace(/^0/, '')}</span>
          <span className="ta-call-day-section__weekday">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(`${day.date}T12:00:00+09:00`).getUTCDay()]}
          </span>
        </div>
        <div className="ta-call-day-section__summary">
          <span className="ta-call-day-section__ratio">{ratio}</span>
          <span className={`ta-call-day-section__badge ta-call-day-section__badge--${badge.replace(/\s+/g, '-')}`}>
            {badge}
          </span>
        </div>
        {layout === 'pc' && day.totalCount > 0 ? (
          <div className="ta-call-day-section__stats">
            통화완료 {day.completedCount}, 부재중 {day.noAnswerCount}, 미통화 {day.notCalledCount} | {ratio}
          </div>
        ) : null}
      </header>

      {day.isFuture || day.totalCount === 0 ? (
        <p className="ta-call-day-section__empty">{emptyMessage}</p>
      ) : layout === 'pc' ? (
        <div className="ta-call-day-section__table">
          <div className="ta-call-assignment-row ta-call-assignment-row--head">
            <div>고객명</div>
            <div>생년월일</div>
            <div>연락처</div>
            <div>상태</div>
            <div>상태 변경</div>
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
      ) : (
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
      )}
    </section>
  )
}
