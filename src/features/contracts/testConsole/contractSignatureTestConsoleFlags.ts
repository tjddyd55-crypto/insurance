/** Vite: 전자서명 관리 메뉴·라우트 노출(개발 빌드 또는 env 명시 시) */
export function isContractSignatureTestMenuEnabled(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env.VITE_ENABLE_CONTRACT_SIGNATURE_TEST_MENU === 'true'
  )
}

/** SUPER_ADMIN · GA_ADMIN 만 — 스태프/일반 고객·원수사 채널은 제외 */
export function canAccessContractSignatureTestConsole(role: string | undefined): boolean {
  const r = role ?? ''
  return r === 'SUPER_ADMIN' || r === 'GA_ADMIN'
}
