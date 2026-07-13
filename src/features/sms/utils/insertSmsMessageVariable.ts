export function insertSmsMessageVariable(
  messageBody: string,
  token: string,
  selectionStart: number,
  selectionEnd: number,
): { text: string; cursor: number } {
  const start = Math.max(0, Math.min(selectionStart, messageBody.length))
  const end = Math.max(start, Math.min(selectionEnd, messageBody.length))
  const nextText = `${messageBody.slice(0, start)}${token}${messageBody.slice(end)}`
  const cursor = start + token.length
  return { text: nextText, cursor }
}
