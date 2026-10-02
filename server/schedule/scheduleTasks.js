/**
 * 일정 관리의 "할 일" 공통 모델. Google Tasks 와 ONE FC 할 일(todos)을 같은 모양으로 바꾼다.
 * 할 일은 시간 축에 올리지 않는다(시간을 지어내지 않음). 날짜는 달력일(YYYY-MM-DD) 문자열만 쓴다.
 */

const YMD = /^(\d{4})-(\d{2})-(\d{2})/
const NOTES_LIMIT = 8000

/**
 * Google Tasks `due` 는 의미상 날짜만이다(예: 2026-10-03T00:00:00.000Z).
 * Date/시간대 변환 없이 문자열 앞 10자만 쓴다. 그래야 KST 에서 하루 밀리지 않는다.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function googleTaskDueDate(raw) {
  const match = YMD.exec(String(raw ?? '').trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

/**
 * @param {unknown} raw
 */
function optionalText(raw) {
  const text = String(raw ?? '').trim()
  return text || null
}

/**
 * Google Tasks tasks.list item → 공통 할 일. 삭제된 건은 버린다. 원본은 넘기지 않는다.
 * @param {Record<string, any>} item
 * @param {{ id: string, name?: string }} taskList
 */
export function normalizeGoogleTask(item, taskList) {
  if (!item || !item.id || item.deleted === true) {
    return null
  }
  const taskListId = String(taskList.id)
  return {
    id: `google_task:${taskListId}:${String(item.id)}`,
    source: 'google_task',
    sourceId: String(item.id),
    taskListId,
    taskListName: String(taskList.name ?? ''),
    title: String(item.title ?? '').trim() || '(제목 없음)',
    notes: String(item.notes ?? '').trim().slice(0, NOTES_LIMIT),
    dueDate: googleTaskDueDate(item.due),
    dueTime: null,
    status: item.status === 'completed' ? 'completed' : 'open',
    completedAt: optionalText(item.completed),
    parentId: optionalText(item.parent),
    updatedAt: optionalText(item.updated),
    customerId: null,
    customerName: '',
    readOnly: true,
  }
}

/**
 * Google Tasks tasklists.list item → 목록 요약.
 * @param {Record<string, any>} item
 */
export function normalizeGoogleTaskList(item) {
  if (!item || !item.id) {
    return null
  }
  return {
    id: String(item.id),
    name: String(item.title ?? '').trim() || '내 할 일 목록',
  }
}

/**
 * 기존 할 일 API(mapTodoRow) 결과 → 공통 할 일. 일정 화면에서는 조회만 한다(수정은 할 일 화면).
 * 취소된 할 일은 열린/완료 어느 쪽도 아니라 넘기지 않는다.
 * @param {Record<string, any>} todo mapTodoRow 결과
 */
export function normalizeOnefcTodo(todo) {
  if (!todo || !todo.id || todo.status === 'canceled') {
    return null
  }
  const customerId = todo.relatedEntityType === 'customer' && /^\d+$/.test(String(todo.relatedEntityId ?? '').trim())
    ? Number(String(todo.relatedEntityId).trim())
    : null
  return {
    id: `onefc_todo:${String(todo.id)}`,
    source: 'onefc_todo',
    sourceId: String(todo.id),
    taskListId: null,
    taskListName: '',
    title: String(todo.title ?? '').trim() || '(제목 없음)',
    notes: String(todo.description ?? '').trim().slice(0, NOTES_LIMIT),
    dueDate: googleTaskDueDate(todo.dueDate),
    dueTime: todo.dueTime ? String(todo.dueTime).slice(0, 5) : null,
    status: todo.status === 'completed' ? 'completed' : 'open',
    completedAt: optionalText(todo.completedAt),
    parentId: null,
    updatedAt: optionalText(todo.updatedAt),
    customerId,
    customerName: String(todo.customerName ?? ''),
    readOnly: true,
  }
}

/**
 * 화면 기간에 필요한 할 일만: 기간 안 예정일, 예정일 없음(날짜 없음), 오늘 이전인데 열린 것(지난 할 일).
 * 날짜는 문자열 비교만 한다.
 * @param {Array<{ dueDate: string | null, status: string }>} tasks
 * @param {{ fromYmd: string, toYmd: string, todayYmd: string }} range
 */
export function selectScheduleTasks(tasks, range) {
  return tasks.filter((task) => {
    if (!task.dueDate) return true
    if (task.dueDate >= range.fromYmd && task.dueDate <= range.toYmd) return true
    return task.status === 'open' && task.dueDate < range.todayYmd
  })
}

/**
 * @param {{ dueDate: string | null, status: string }} task
 * @param {string} todayYmd
 */
export function isOverdueTask(task, todayYmd) {
  return Boolean(task.dueDate) && task.status === 'open' && String(task.dueDate) < todayYmd
}

/**
 * 예정일 → 날짜 없음은 뒤, 같은 날은 열린 것 먼저, 그다음 제목.
 * @param {Array<Record<string, any>>} tasks
 */
export function sortScheduleTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDue = left.dueDate ?? '9999-99-99'
    const rightDue = right.dueDate ?? '9999-99-99'
    if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1
    if (left.status !== right.status) return left.status === 'open' ? -1 : 1
    return String(left.title).localeCompare(String(right.title), 'ko')
  })
}
