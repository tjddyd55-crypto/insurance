/** 복사 버튼이 쓰던 표시 시간과 같다. 상담 성공도 이 값만 쓴다. */
export const PUBLIC_ADVISOR_TOAST_MS = 1600

export const PUBLIC_ADVISOR_COPY_TOAST = '복사되었습니다.'
export const PUBLIC_ADVISOR_CONSULT_SUCCESS_TOAST = '상담 신청이 접수되었습니다.'

let message = ''
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function getPublicAdvisorToast(): string {
  return message
}

export function subscribePublicAdvisorToast(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function showPublicAdvisorToast(next: string): void {
  const text = next.trim()
  if (!text) return
  message = text
  emit()
  if (timer != null) globalThis.clearTimeout(timer)
  timer = globalThis.setTimeout(() => {
    message = ''
    emit()
  }, PUBLIC_ADVISOR_TOAST_MS)
}

/** 테스트에서 타이머와 문구를 비운다. */
export function resetPublicAdvisorToast(): void {
  if (timer != null) globalThis.clearTimeout(timer)
  timer = null
  message = ''
  emit()
}
