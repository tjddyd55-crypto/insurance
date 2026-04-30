/** Vite feature flag: 전자서명 테스트 콘솔 메뉴·라우트 노출 */
export function isContractSignatureTestMenuEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true
  }
  return import.meta.env.VITE_ENABLE_CONTRACT_SIGNATURE_TEST_MENU === 'true'
}

/** SUPER_ADMIN · GA_ADMIN 만 — 스태프/일반 고객·원수사 채널은 제외 */
export function canAccessContractSignatureTestConsole(role: string | undefined): boolean {
  const r = role ?? ''
  return r === 'SUPER_ADMIN' || r === 'GA_ADMIN'
}
