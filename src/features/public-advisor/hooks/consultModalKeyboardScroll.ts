const DEFAULT_PADDING_PX = 12

/**
 * visualViewport 기준으로 field가 키보드에 가려질 때만 modal body scrollTop을 조정한다.
 * scrollIntoView는 사용하지 않는다.
 */
export function adjustModalBodyScrollForFocusedField(
  scrollRoot: HTMLElement,
  field: HTMLElement,
  paddingPx = DEFAULT_PADDING_PX,
): void {
  const vv = window.visualViewport
  if (!vv) return

  const visibleTop = vv.offsetTop + paddingPx
  const visibleBottom = vv.offsetTop + vv.height - paddingPx
  const fieldRect = field.getBoundingClientRect()

  if (fieldRect.top >= visibleTop && fieldRect.bottom <= visibleBottom) {
    return
  }

  if (fieldRect.bottom > visibleBottom) {
    scrollRoot.scrollTop += fieldRect.bottom - visibleBottom
    return
  }

  if (fieldRect.top < visibleTop) {
    scrollRoot.scrollTop -= visibleTop - fieldRect.top
  }
}

export function measureConsultModalChromePx(formEl: HTMLElement): number {
  const header = formEl.querySelector('.pap-modal__header')
  const footer = formEl.querySelector('.pap-modal__footer')
  const headerH = header instanceof HTMLElement ? header.offsetHeight : 0
  const footerH = footer instanceof HTMLElement ? footer.offsetHeight : 0
  return headerH + footerH
}
