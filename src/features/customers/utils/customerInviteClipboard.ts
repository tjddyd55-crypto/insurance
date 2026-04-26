/** WebView: touchstart·mousedown·합성 click 연속 시 복사/알림 중복 방지 */
export const INVITE_COPY_POINTER_DEBOUNCE_MS = 450

/**
 * 고객 등록 초대 링크를 클립보드에 복사한다.
 *
 * 우선 navigator.clipboard를 사용하고, WebView/구형 브라우저에서 실패하면
 * textarea + execCommand('copy') fallback을 사용한다.
 */
export async function copyTextWithWebViewFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)

    try {
      textarea.focus()
      textarea.select()
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}
