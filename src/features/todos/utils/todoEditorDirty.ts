/** 할 일 편집 폼에서 실제로 저장되는 값만 모은 것 (TodoEditorDialog 수정 저장 본문 기준). */
export type TodoEditorForm = {
  description: string
  dueDate: string
  relatedEntityType: string
  relatedEntityId: string
}

function normalizeTodoEditorForm(form: TodoEditorForm): TodoEditorForm {
  const relatedEntityType = form.relatedEntityType.trim()
  return {
    description: form.description.trim(),
    dueDate: form.dueDate.trim(),
    relatedEntityType,
    relatedEntityId: relatedEntityType ? form.relatedEntityId.trim() : '',
  }
}

/**
 * 편집을 연 시점의 폼과 저장 직전 폼을 저장 규칙대로 비교한다.
 * 바뀐 값이 없으면 저장 요청을 보내지 않는다(서버도 같은 값이면 수정하지 않음).
 */
export function isTodoEditorFormChanged(initial: TodoEditorForm, current: TodoEditorForm): boolean {
  const a = normalizeTodoEditorForm(initial)
  const b = normalizeTodoEditorForm(current)
  return (
    a.description !== b.description ||
    a.dueDate !== b.dueDate ||
    a.relatedEntityType !== b.relatedEntityType ||
    a.relatedEntityId !== b.relatedEntityId
  )
}
