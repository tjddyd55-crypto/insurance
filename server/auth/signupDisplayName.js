/**
 * 회원가입 표시 이름 SSOT — users.display_name 에 저장되는 값.
 */

/**
 * @param {Record<string, unknown> | null | undefined} body
 */
export function resolveSignupDisplayName(body) {
  const nameRaw = body?.name
  const displayNameRaw = body?.display_name ?? body?.displayName
  return String(nameRaw ?? displayNameRaw ?? '').trim()
}
