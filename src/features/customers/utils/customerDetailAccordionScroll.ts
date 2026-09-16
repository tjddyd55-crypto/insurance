/**
 * Accordion toggle 후 target header viewport 위치를 유지하기 위한 scroll 보정.
 * scrollIntoView 는 사용하지 않는다 (block:start 로 상단 점프 방지).
 */
export function computeAccordionScrollCompensation(params: {
  beforeTop: number
  afterTop: number
}): number {
  return params.afterTop - params.beforeTop
}

export function applyAccordionScrollCompensation(params: {
  container: HTMLElement
  beforeTop: number
  target: HTMLElement
  behavior?: ScrollBehavior
}): number {
  const afterTop = params.target.getBoundingClientRect().top
  const delta = computeAccordionScrollCompensation({
    beforeTop: params.beforeTop,
    afterTop,
  })
  if (Math.abs(delta) < 0.5) {
    return params.container.scrollTop
  }
  const nextTop = Math.max(0, params.container.scrollTop + delta)
  params.container.scrollTo({ top: nextTop, behavior: params.behavior ?? 'auto' })
  return nextTop
}
