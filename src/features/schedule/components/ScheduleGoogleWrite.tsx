import { TodoEditorDialog } from '../../todos/components/TodoEditorDialog'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import AppDateInput from '../../../components/common/AppDateInput'
import AppTimeInput from '../../../components/common/AppTimeInput'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { defaultNewItemDate } from '../../../utils/dateInput'
import {
  buildScheduleEventInput,
  createScheduleTimeFields,
  editScheduleTimeFields,
  toggleScheduleTimeSpecified,
  withScheduleEndTime,
  withScheduleStartTime,
} from '../domain/scheduleEventTimeFields'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { Button } from '../../../components/ui'
import { ApiError } from '../../../lib/apiClient'
import { isDesktopAppRuntime } from '../../service-integrations/hooks/useServiceIntegrationsState'
import {
  createGoogleEvent,
  createGoogleTask,
  deleteGoogleEvent,
  deleteGoogleTask,
  EMPTY_GOOGLE_WRITE_STATE,
  fetchGoogleWriteTargets,
  GOOGLE_READ_ONLY_REASON,
  newGoogleRequestId,
  startGoogleWriteConsent,
  updateGoogleEvent,
  updateGoogleTask,
  type GoogleWriteTargets,
  type ScheduleEvent,
  type ScheduleTask,
} from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'

type Kind = 'google_event' | 'google_task' | 'onefc_todo'

type EventForm = {
  mode: 'create' | 'edit'
  eventId: string
  calendarId: string
  title: string
  description: string
  date: string
  endDate: string
  allDay: boolean
  startTime: string
  endTime: string
}

type TaskForm = { mode: 'create' | 'edit'; taskId: string; taskListId: string; title: string; notes: string; dueDate: string }

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Google 에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function needsConsent(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'write_scope_missing'
}

/** 'HH:mm' (KST) of an RFC3339 time */
function kstHm(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '09:00'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
}

function kstYmd(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d + days))
  return at.toISOString().slice(0, 10)
}

/**
 * t307 일정 관리 Google 쓰기. 기능 플래그(google.write.enabled)가 꺼져 있으면 아무것도 그리지 않는다.
 * 세 저장 위치(Google 일정 / Google 할 일 / ONE FC 할 일)는 서로 다른 저장소라 따로 저장한다.
 * ONE FC 할 일은 할 일 목록과 같은 작성 창(TodoEditorDialog)을 일정 관리 위에서 바로 연다(t327, 화면 이동 없음).
 */
export function useScheduleGoogleWrite(props: Pick<ScheduleViewProps, 'token' | 'google' | 'selectedDate' | 'today' | 'onReload' | 'userKey' | 'gaId'>) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const write = props.google.write ?? EMPTY_GOOGLE_WRITE_STATE
  const enabled = write.enabled && props.google.status === 'connected'
  const [chooserOpen, setChooserOpen] = useState(false)
  const [todoCreate, setTodoCreate] = useState<{ due: string; session: number } | null>(null)
  const [targets, setTargets] = useState<GoogleWriteTargets | null>(null)
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [consentNeeded, setConsentNeeded] = useState(false)
  const [notice, setNotice] = useState('')
  // 같은 저장 시도(재시도 포함)는 같은 requestId. 창을 새로 열 때만 바꾼다.
  const requestIdRef = useRef('')

  const loadTargets = useCallback(async () => {
    const next = await fetchGoogleWriteTargets(props.token)
    setTargets(next)
    return next
  }, [props.token])

  const baseDate = defaultNewItemDate(props.selectedDate || props.today)

  const reset = () => {
    setError('')
    setConsentNeeded(false)
    setBusy(false)
  }

  const openChooser = () => {
    reset()
    setChooserOpen(true)
    if (enabled) void loadTargets().catch((loadError) => setError(messageOf(loadError)))
  }

  const askConsent = async () => {
    setBusy(true)
    setError('')
    try {
      const desktop = isDesktopAppRuntime()
      const out = await startGoogleWriteConsent(props.token, desktop)
      if (!/^https:\/\/accounts\.google\.com\//.test(out.url)) throw new Error('bad_url')
      if (desktop) {
        window.open(out.url, '_blank', 'noopener,noreferrer')
        setNotice('브라우저에서 Google 권한 허용을 마친 뒤 ONE FC 로 돌아와 다시 시도해 주세요.')
        setBusy(false)
        return
      }
      window.location.assign(out.url)
    } catch (consentError) {
      setBusy(false)
      setError(messageOf(consentError))
    }
  }

  const choose = (kind: Kind) => {
    setChooserOpen(false)
    reset()
    requestIdRef.current = newGoogleRequestId()
    if (kind === 'onefc_todo') {
      setTodoCreate((current) => ({ due: baseDate, session: (current?.session ?? 0) + 1 }))
      return
    }
    if (kind === 'google_event') {
      const calendarId = targets?.calendars.find((calendar) => calendar.primary)?.id ?? targets?.calendars[0]?.id ?? ''
      if (!write.calendarWritable) setConsentNeeded(true)
      setEventForm({ mode: 'create', eventId: '', calendarId, title: '', description: '', date: baseDate, endDate: baseDate, ...createScheduleTimeFields() })
      return
    }
    if (!write.tasksWritable) setConsentNeeded(true)
    setTaskForm({ mode: 'create', taskId: '', taskListId: targets?.taskLists[0]?.id ?? '', title: '', notes: '', dueDate: baseDate })
  }

  const openEditEvent = (event: ScheduleEvent) => {
    reset()
    void loadTargets().catch(() => undefined)
    const date = event.allDay ? event.startAt.slice(0, 10) : kstYmd(event.startAt)
    const endDate = event.allDay ? addDays(event.endAt.slice(0, 10), -1) : kstYmd(event.endAt)
    setEventForm({
      mode: 'edit',
      eventId: event.sourceId,
      calendarId: event.calendarId ?? '',
      title: event.title,
      description: event.description,
      date,
      endDate: endDate < date ? date : endDate,
      ...editScheduleTimeFields({
        allDay: event.allDay,
        startTime: event.allDay ? '' : kstHm(event.startAt),
        endTime: event.allDay ? '' : kstHm(event.endAt),
      }),
    })
  }

  const openEditTask = (task: ScheduleTask) => {
    reset()
    setTaskForm({ mode: 'edit', taskId: task.sourceId, taskListId: task.taskListId ?? '', title: task.title, notes: task.notes, dueDate: task.dueDate ?? '' })
  }

  const finish = (text: string) => {
    setEventForm(null)
    setTaskForm(null)
    setBusy(false)
    setNotice(text)
    props.onReload()
    window.setTimeout(() => setNotice(''), 4000)
  }

  const fail = (saveError: unknown) => {
    setBusy(false)
    if (needsConsent(saveError)) setConsentNeeded(true)
    setError(messageOf(saveError))
  }

  const saveEvent = async () => {
    if (!eventForm || busy) return
    if (!eventForm.title.trim()) return setError('제목을 입력해 주세요.')
    if (!eventForm.calendarId) return setError('저장할 캘린더를 선택해 주세요.')
    setBusy(true)
    setError('')
    const input = buildScheduleEventInput(eventForm)
    try {
      if (eventForm.mode === 'create') await createGoogleEvent(props.token, { ...input, requestId: requestIdRef.current })
      else await updateGoogleEvent(props.token, { ...input, eventId: eventForm.eventId })
      finish(eventForm.mode === 'create' ? 'Google 일정을 저장했습니다.' : 'Google 일정을 수정했습니다.')
    } catch (saveError) {
      fail(saveError)
    }
  }

  const removeEvent = async (event: ScheduleEvent, closeDetail: () => void) => {
    if (busy) return
    if (!(await confirm({ title: 'Google 일정 삭제', message: '이 Google 일정을 삭제할까요? Google Calendar 에서도 삭제됩니다.', confirmLabel: '삭제', cancelLabel: '취소' }))) return
    setBusy(true)
    setError('')
    try {
      await deleteGoogleEvent(props.token, event.calendarId ?? '', event.sourceId)
      closeDetail()
      finish('Google 일정을 삭제했습니다.')
    } catch (deleteError) {
      fail(deleteError)
      setNotice(messageOf(deleteError))
    }
  }

  const saveTask = async () => {
    if (!taskForm || busy) return
    if (!taskForm.title.trim()) return setError('제목을 입력해 주세요.')
    if (!taskForm.taskListId) return setError('할 일 목록을 선택해 주세요.')
    setBusy(true)
    setError('')
    try {
      if (taskForm.mode === 'create') {
        await createGoogleTask(props.token, { taskListId: taskForm.taskListId, title: taskForm.title, notes: taskForm.notes, dueDate: taskForm.dueDate || null, requestId: requestIdRef.current })
      } else {
        await updateGoogleTask(props.token, { taskListId: taskForm.taskListId, taskId: taskForm.taskId, title: taskForm.title, notes: taskForm.notes, dueDate: taskForm.dueDate || null })
      }
      finish(taskForm.mode === 'create' ? 'Google 할 일을 저장했습니다.' : 'Google 할 일을 수정했습니다.')
    } catch (saveError) {
      fail(saveError)
    }
  }

  const toggleTask = async (task: ScheduleTask, closeDetail: () => void) => {
    if (busy) return
    setBusy(true)
    try {
      await updateGoogleTask(props.token, { taskListId: task.taskListId ?? '', taskId: task.sourceId, completed: task.status !== 'completed' })
      closeDetail()
      finish(task.status === 'completed' ? 'Google 할 일을 미완료로 바꿨습니다.' : 'Google 할 일을 완료했습니다.')
    } catch (toggleError) {
      fail(toggleError)
      setNotice(messageOf(toggleError))
    }
  }

  const removeTask = async (task: ScheduleTask, closeDetail: () => void) => {
    if (busy) return
    if (!(await confirm({ title: 'Google 할 일 삭제', message: '이 Google 할 일을 삭제할까요? Google Tasks 에서도 삭제됩니다.', confirmLabel: '삭제', cancelLabel: '취소' }))) return
    setBusy(true)
    try {
      await deleteGoogleTask(props.token, task.taskListId ?? '', task.sourceId)
      closeDetail()
      finish('Google 할 일을 삭제했습니다.')
    } catch (deleteError) {
      fail(deleteError)
      setNotice(messageOf(deleteError))
    }
  }

  const consentBlock = consentNeeded ? (
    <div className="schedule-page__google-hint schedule-page__google-hint--warn" role="status">
      <p>Google 일정·할 일을 저장하려면 쓰기 권한을 추가로 허용해야 합니다. 기존 조회 연결은 그대로 유지됩니다.</p>
      <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => void askConsent()}>Google 쓰기 권한 허용</Button>
    </div>
  ) : null

  // ONE FC 할 일은 Google 연결과 무관하게 추가할 수 있으므로 버튼은 항상 보인다.
  const toolbarButton: ReactNode = (
    <Button type="button" variant="primary" size="sm" onClick={openChooser}>새 항목 추가</Button>
  )

  const noticeNode: ReactNode = notice ? <span className="schedule-page__refresh-message" role="status">{notice}</span> : null

  const calendarOptions = (targets?.calendars ?? []).map((calendar) => ({ value: calendar.id, label: calendar.primary ? `${calendar.name} (기본)` : calendar.name }))
  const taskListOptions = (targets?.taskLists ?? []).map((list) => ({ value: list.id, label: list.name }))
  // 편집 중 목록이 아직 안 왔으면 현재 값 하나라도 보이게
  if (eventForm && eventForm.calendarId && !calendarOptions.some((option) => option.value === eventForm.calendarId)) {
    calendarOptions.unshift({ value: eventForm.calendarId, label: eventForm.calendarId })
  }
  if (taskForm && taskForm.taskListId && !taskListOptions.some((option) => option.value === taskForm.taskListId)) {
    taskListOptions.unshift({ value: taskForm.taskListId, label: '현재 목록' })
  }

  const dialogs: ReactNode = (
    <>
      {confirmDialog}
      <TodoEditorDialog
        open={Boolean(todoCreate)}
        onClose={() => setTodoCreate(null)}
        token={props.token}
        gaId={props.gaId}
        sessionKey={todoCreate?.session ?? 0}
        prefill={todoCreate ? { sourceType: 'manual', description: '', dueDate: todoCreate.due } : null}
        onCommitted={() => finish('ONE FC 할 일을 추가했습니다.')}
      />
      {chooserOpen ? (
        <FormDialog open title="새 항목 추가" closeOnBackdrop closeOnEsc onClose={() => setChooserOpen(false)}>
          <p className="schedule-page__dialog-sub">{baseDate} · ONE FC에 저장합니다.</p>
          <div className="schedule-page__dialog-actions schedule-page__new-kinds">
            <FormButton htmlType="button" variant="secondary" disabled={!enabled} onClick={() => choose('google_event')}>일정 추가</FormButton>
            <FormButton htmlType="button" variant="secondary" onClick={() => choose('onefc_todo')}>할 일 추가</FormButton>
          </div>
          {!enabled ? <p className="schedule-page__dialog-sub">일정 추가는 Google 연동 후 사용할 수 있습니다.</p> : null}
          {error ? <p className="schedule-page__error" role="alert">{error}</p> : null}
        </FormDialog>
      ) : null}
      {eventForm ? (
        <FormDialog
          open
          title={eventForm.mode === 'create' ? '일정 추가' : '일정 수정'}
          disableClose={busy}
          onClose={() => setEventForm(null)}
          footer={(
            <div className="schedule-page__dialog-actions">
              <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => setEventForm(null)}>취소</FormButton>
              <FormButton htmlType="button" variant="primary" loading={busy} loadingText="저장 중…" disabled={consentNeeded} onClick={() => void saveEvent()}>저장</FormButton>
            </div>
          )}
        >
          {consentBlock}
          <label className="schedule-page__field"><span>제목</span><FormInput value={eventForm.title} maxLength={300} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></label>
          <label className="schedule-page__field">
            <span>캘린더</span>
            <FormSelect value={eventForm.calendarId} disabled={eventForm.mode === 'edit'} options={calendarOptions.length ? calendarOptions : [{ value: '', label: '쓰기 가능한 캘린더 없음' }]} onChange={(e) => setEventForm({ ...eventForm, calendarId: e.target.value })} />
          </label>
          <div className="schedule-page__field">
            <Button
              type="button"
              size="sm"
              aria-pressed={!eventForm.allDay}
              aria-label="시간 지정"
              variant={!eventForm.allDay ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => setEventForm({ ...eventForm, ...toggleScheduleTimeSpecified(eventForm) })}
            >
              시간 지정
            </Button>
          </div>
          <label className="schedule-page__field"><span>시작일</span><AppDateInput entry="picker" aria-label="시작일" value={eventForm.date} onChange={(value) => setEventForm({ ...eventForm, date: value, endDate: eventForm.endDate < value ? value : eventForm.endDate })} /></label>
          {!eventForm.allDay ? (
            <div className="schedule-page__field">
              <span>시작 시간</span>
              <AppTimeInput ariaLabel="시작 시간" disabled={busy} value={eventForm.startTime} onChange={(startTime) => setEventForm({ ...eventForm, ...withScheduleStartTime(eventForm, startTime) })} />
            </div>
          ) : null}
          <label className="schedule-page__field"><span>종료일</span><AppDateInput entry="picker" aria-label="종료일" value={eventForm.endDate} min={eventForm.date} onChange={(value) => setEventForm({ ...eventForm, endDate: value })} /></label>
          {!eventForm.allDay ? (
            <div className="schedule-page__field">
              <span>종료 시간</span>
              <AppTimeInput ariaLabel="종료 시간" disabled={busy} value={eventForm.endTime} onChange={(endTime) => setEventForm({ ...eventForm, ...withScheduleEndTime(eventForm, endTime) })} />
            </div>
          ) : null}
          <label className="schedule-page__field"><span>설명</span><FormTextarea rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label>
          {error ? <p className="schedule-page__error" role="alert">{error}</p> : null}
        </FormDialog>
      ) : null}
      {taskForm ? (
        <FormDialog
          open
          title={taskForm.mode === 'create' ? 'Google 할 일 추가' : 'Google 할 일 수정'}
          disableClose={busy}
          onClose={() => setTaskForm(null)}
          footer={(
            <div className="schedule-page__dialog-actions">
              <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => setTaskForm(null)}>취소</FormButton>
              <FormButton htmlType="button" variant="primary" loading={busy} loadingText="저장 중…" disabled={consentNeeded} onClick={() => void saveTask()}>저장</FormButton>
            </div>
          )}
        >
          {consentBlock}
          <label className="schedule-page__field"><span>제목</span><FormInput value={taskForm.title} maxLength={300} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></label>
          <label className="schedule-page__field">
            <span>목록</span>
            <FormSelect value={taskForm.taskListId} disabled={taskForm.mode === 'edit'} options={taskListOptions.length ? taskListOptions : [{ value: '', label: '할 일 목록 없음' }]} onChange={(e) => setTaskForm({ ...taskForm, taskListId: e.target.value })} />
          </label>
          <div className="schedule-page__field">
            <span>날짜</span>
            <AppDateInput entry="picker" aria-label="날짜" placeholder="날짜 선택" value={taskForm.dueDate} onChange={(value) => setTaskForm({ ...taskForm, dueDate: value })} />
            {taskForm.dueDate ? (
              <FormButton htmlType="button" variant="action" size="sm" onClick={() => setTaskForm({ ...taskForm, dueDate: '' })}>날짜 지우기</FormButton>
            ) : null}
          </div>
          <p className="schedule-page__dialog-sub">Google 할 일은 날짜만 저장됩니다(시간 없음).</p>
          <label className="schedule-page__field"><span>메모</span><FormTextarea rows={3} value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} /></label>
          {error ? <p className="schedule-page__error" role="alert">{error}</p> : null}
        </FormDialog>
      ) : null}
    </>
  )

  /** Google 일정 상세 하단 버튼(쓰기 가능할 때만) 또는 읽기 전용 사유 */
  const eventActions = (event: ScheduleEvent, closeDetail: () => void): ReactNode => {
    if (!enabled || event.source !== 'google') return null
    if (!event.writable) {
      return <span className="schedule-page__dialog-sub">{GOOGLE_READ_ONLY_REASON[event.readOnlyReason ?? ''] ?? '이 일정은 읽기 전용입니다.'}</span>
    }
    return (
      <>
        <FormButton htmlType="button" variant="danger" disabled={busy} onClick={() => void removeEvent(event, closeDetail)}>삭제</FormButton>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => { closeDetail(); openEditEvent(event) }}>수정</FormButton>
      </>
    )
  }

  const taskActions = (task: ScheduleTask, closeDetail: () => void): ReactNode => {
    if (!enabled || task.source !== 'google_task' || task.parentId) return null
    return (
      <>
        <FormButton htmlType="button" variant="danger" disabled={busy} onClick={() => void removeTask(task, closeDetail)}>삭제</FormButton>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => void toggleTask(task, closeDetail)}>{task.status === 'completed' ? '미완료로' : '완료'}</FormButton>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => { closeDetail(); openEditTask(task) }}>수정</FormButton>
      </>
    )
  }

  return { enabled, toolbarButton, noticeNode, dialogs, eventActions, taskActions }
}
