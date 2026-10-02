import type { ScheduleFilterKey, ScheduleTask } from '../api/scheduleApi'

/** 할 일 날짜는 문자열 비교만 한다(Date/시간대 변환 없음). */
export function isOverdueTask(task: Pick<ScheduleTask, 'dueDate' | 'status'>, today: string): boolean {
  return Boolean(task.dueDate) && task.status === 'open' && String(task.dueDate) < today
}

export function tasksOnDate(tasks: ScheduleTask[], date: string): ScheduleTask[] {
  return tasks.filter((task) => task.dueDate === date)
}

/** 예정일 순, 날짜 없음은 뒤, 같은 날은 열린 것 먼저, 그다음 제목. */
export function sortScheduleTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  return [...tasks].sort((left, right) => {
    const leftDue = left.dueDate ?? '9999-99-99'
    const rightDue = right.dueDate ?? '9999-99-99'
    if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1
    if (left.status !== right.status) return left.status === 'open' ? -1 : 1
    return left.title.localeCompare(right.title, 'ko')
  })
}

/** 출처 필터 + 완료 포함 여부. 기본은 열린 할 일만. */
export function filterScheduleTasks(tasks: ScheduleTask[], sources: ScheduleFilterKey[], includeCompleted: boolean): ScheduleTask[] {
  return tasks.filter((task) => sources.includes(task.source) && (includeCompleted || task.status !== 'completed'))
}

/**
 * 목록 화면 묶음. 서로 겹치지 않는다.
 * - 지난 할 일: 예정일 < 오늘(KST) 이고 미완료
 * - 할 일: 화면 기간 안 예정일(지난 할 일 제외)
 * - 날짜 없음: 예정일 없음(월간 칸에는 올리지 않지만 빠뜨리지 않는다)
 */
export function groupListTasks(tasks: ScheduleTask[], range: { start: string; end: string }, today: string) {
  const sorted = sortScheduleTasks(tasks)
  const overdue = sorted.filter((task) => isOverdueTask(task, today))
  const dated = sorted.filter((task) => task.dueDate && !isOverdueTask(task, today) && task.dueDate >= range.start && task.dueDate <= range.end)
  const undated = sorted.filter((task) => !task.dueDate)
  return { overdue, dated, undated }
}
