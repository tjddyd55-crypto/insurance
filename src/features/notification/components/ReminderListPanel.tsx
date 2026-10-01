import { FormButton, FormInput, FormSelect } from '../../../components/form'
import { FormDialog } from '../../../components/dialog'
import { REMINDER_TYPE_LABEL, type ReminderEvent } from '../api/reminderApi'
import type { NotificationHubViewProps } from '../hooks/useNotificationHubState'

const TYPE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'insurance_age_date', label: '상령일' },
  { value: 'car_expiry', label: '자동차 만기' },
  { value: 'special_date', label: '알림일' },
]

const SORT_OPTIONS = [
  { value: 'soon', label: '빠른 순' },
  { value: 'late', label: '늦은 순' },
  { value: 'created', label: '최근 등록순' },
  { value: 'name', label: '고객명' },
]

export default function ReminderListPanel(props: NotificationHubViewProps) {
  return (
    <section className="notification-hub__list" aria-label="전체 알림">
      <div className="notification-hub__filters">
        <FormSelect aria-label="유형" value={props.listType} options={TYPE_OPTIONS} onChange={(event) => props.onListType(event.target.value)} />
        <FormInput aria-label="시작일" type="date" value={props.from} onChange={(event) => props.onFrom(event.target.value)} />
        <FormInput aria-label="종료일" type="date" value={props.to} onChange={(event) => props.onTo(event.target.value)} />
        <FormInput aria-label="검색" type="search" value={props.query} placeholder="이름, 전화번호, 내용" onChange={(event) => props.onQuery(event.target.value)} />
        <FormSelect aria-label="정렬" value={props.sort} options={SORT_OPTIONS} onChange={(event) => props.onSort(event.target.value)} />
      </div>
      {props.loading ? <p>알림을 불러오는 중…</p> : null}
      {props.error ? <p className="notification-hub__error">{props.error}</p> : null}
      <ul>
        {props.events.map((event) => (
          <li key={event.id} className="notification-hub__list-row">
            <button type="button" className="notification-hub__list-main" onClick={() => props.onOpenCustomer(event)}>
              <span>{event.startDate}</span>
              <span>{event.customerName}</span>
              <span>{REMINDER_TYPE_LABEL[event.type]}</span>
              <span>{event.content}</span>
              <span>{event.assigneeName || '담당자 없음'}</span>
            </button>
            {event.type === 'special_date' && event.sourceId ? (
              <span className="notification-hub__row-actions">
                <FormButton htmlType="button" variant="secondary" onClick={() => props.onEdit(event)}>수정</FormButton>
                <FormButton htmlType="button" variant="danger" onClick={() => props.onDelete(event)}>삭제</FormButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {props.editing ? (
        <FormDialog
          open
          title="알림일 수정"
          closeOnBackdrop={false}
          closeOnEsc={false}
          onEscapeRequest={props.onCloseEdit}
          onClose={props.onCloseEdit}
          footer={(
            <div className="notification-hub__dialog-actions">
              <FormButton htmlType="button" variant="secondary" onClick={props.onCloseEdit}>취소</FormButton>
              <FormButton htmlType="button" variant="primary" onClick={props.onSaveEdit}>저장</FormButton>
            </div>
          )}
        >
          <label className="notification-hub__field">
            <span>내용</span>
            <FormInput value={props.editTitle} onChange={(event) => props.onEditTitle(event.target.value)} />
          </label>
          <label className="notification-hub__field">
            <span>날짜</span>
            <FormInput type="date" value={props.editDate} onChange={(event) => props.onEditDate(event.target.value)} />
          </label>
        </FormDialog>
      ) : null}
    </section>
  )
}
