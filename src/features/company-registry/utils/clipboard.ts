export function copyToClipboard(text: string): void {
  const t = String(text ?? '').trim()
  if (!t) {
    return
  }
  void navigator.clipboard.writeText(t).then(
    () => window.alert('복사되었습니다'),
    () => window.alert('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'),
  )
}
