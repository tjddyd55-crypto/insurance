/**
 * 유저 워크스페이스(로그인 후 GA/설계사 업무) 경로 판별.
 * 관리자·플랫폼·내부 admin 영역은 제외한다.
 */

const ADMIN_PATH_PREFIXES = [
  '/admin/',
  '/internal/admin/',
  '/government/admin',
] as const

/** AppWorkspaceLayout outlet 에 user-app-shell 을 붙일 경로 */
const USER_UI_SHELL_PATTERNS: RegExp[] = [
  /^\/customers(\/|$)/,
  /^\/customer\//,
  /^\/portal\/newsletters/,
  /^\/portal\/adjuster-news/,
  /^\/application\/documents/,
  /^\/insurance\/contacts$/,
  /^\/contacts(\/|$)/,
  /^\/memo(\/|$)/,
  /^\/storage(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/todos(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/dashboard(\/|$)/,
  /^\/claim-requests/,
  /^\/feature-request/,
  /^\/team\/(files|members)/,
  /^\/insurance\/insurer-sites$/,
  /^\/insurer-managers$/,
  /^\/loss-adjusters$/,
  /^\/contracts\/signatures(\/|$)/,
]

export function isAdminWorkspacePath(pathname: string): boolean {
  if (pathname === '/admin') {
    return true
  }
  return ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isUserWorkspacePath(pathname: string): boolean {
  if (isAdminWorkspacePath(pathname)) {
    return false
  }
  return USER_UI_SHELL_PATTERNS.some((pattern) => pattern.test(pathname))
}
