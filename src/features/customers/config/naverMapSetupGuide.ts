/**
 * Naver Cloud Console → Maps → Application → Web 서비스 URL 등록 대상.
 * Dynamic Map 인증은 접속 origin 과 등록 URL 이 일치해야 한다.
 */
export const NAVER_MAP_WEB_SERVICE_URLS = [
  'https://insurance-dev.up.railway.app',
  'https://insurance-production-7bd8.up.railway.app',
  'http://localhost:5173',
  'http://localhost:3000',
] as const

export type NaverMapSetupHint = {
  currentOrigin: string
  registeredUrls: readonly string[]
  consolePath: string
  envNames: readonly string[]
}

export function buildNaverMapSetupHint(origin = ''): NaverMapSetupHint {
  const currentOrigin = origin.trim() || '(unknown)'
  return {
    currentOrigin,
    registeredUrls: NAVER_MAP_WEB_SERVICE_URLS,
    consolePath: 'NAVER Cloud Console → Services → Application Services → Maps → Application → Web 서비스 URL',
    envNames: ['VITE_NAVER_MAP_CLIENT_ID', 'VITE_MAP_PROVIDER'],
  }
}

export function formatNaverMapAuthFailureMessage(origin = ''): string {
  const hint = buildNaverMapSetupHint(origin)
  const originLine =
    hint.currentOrigin !== '(unknown)'
      ? `현재 접속 origin: ${hint.currentOrigin}`
      : '현재 접속 origin을 확인할 수 없습니다.'
  return [
    '네이버 Dynamic Map 인증에 실패했습니다.',
    originLine,
    'Naver Cloud 콘솔 Application의 Web 서비스 URL에 위 origin(프로토콜 포함)이 등록되어 있는지 확인해 주세요.',
    `등록 후보: ${hint.registeredUrls.join(', ')}`,
    '프론트 env: VITE_NAVER_MAP_CLIENT_ID (Geocoding Secret 과 별도로 Dynamic Map Application Client ID)',
  ].join(' ')
}
