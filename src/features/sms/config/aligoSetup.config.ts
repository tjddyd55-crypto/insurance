/** 알리고 연동 설정 안내 — 외부 링크 SSOT */

export const ALIGO_API_SETTINGS_URL = 'https://smartsms.aligo.in/admin/api/auth.html'

/** 알리고 회원가입·로그인 */
export const ALIGO_LOGIN_URL = 'https://www.aligo.in/'

/** 발신번호 관리 (스마트문자 관리자) */
export const ALIGO_SENDER_MANAGEMENT_URL = 'https://smartsms.aligo.in/admin/sender/list.html'

/** 발송 결과·내역 */
export const ALIGO_SEND_HISTORY_URL = 'https://smartsms.aligo.in/admin/result/list.html'

/**
 * env 미설정 시 UI에 EC2 IP 를 하드코딩하지 않는다.
 * 실제 목록은 서버 `SMS_MODULE_OUTBOUND_IP_HINT` SSOT.
 */
export const DEFAULT_ALIGO_OUTBOUND_IPS: readonly string[] = []

/** @deprecated use DEFAULT_ALIGO_OUTBOUND_IPS — 단일 IP UI 제거 */
export const DEFAULT_ALIGO_OUTBOUND_IP = ''

export const ALIGO_SETUP_EXTERNAL_LINKS = [
  { id: 'login', label: '알리고 로그인/회원가입', href: ALIGO_LOGIN_URL },
  { id: 'sender', label: '알리고 발신번호 관리', href: ALIGO_SENDER_MANAGEMENT_URL },
  { id: 'api', label: '알리고 문자 API 신청/인증', href: ALIGO_API_SETTINGS_URL },
  { id: 'history', label: '알리고 발송내역 확인', href: ALIGO_SEND_HISTORY_URL },
] as const

export const ALIGO_SETUP_CHECKLIST = [
  '알리고 회원가입을 완료했나요?',
  '알리고 문자 잔액을 충전했나요?',
  '발신번호 등록이 승인되었나요?',
  '문자 API 신청/인증에서 API Key를 발급받았나요?',
  '발송 서버 IP 허용 목록에 Railway Outbound Static IP를 모두 등록했나요?',
  'CRM에 알리고 아이디, API Key, 기본 발신번호를 입력했나요?',
  '테스트 발송을 완료했나요?',
] as const

/** 표시용 — 서버 배열 우선, 없으면 콤마 문자열 파싱 */
export function resolveAligoOutboundIps(input?: {
  outboundServerIps?: string[] | null
  outboundServerIpHint?: string | null
}): string[] {
  const fromArray = (input?.outboundServerIps ?? [])
    .map((ip) => String(ip ?? '').trim())
    .filter(Boolean)
  if (fromArray.length > 0) {
    return [...new Set(fromArray)]
  }
  const hint = String(input?.outboundServerIpHint ?? '').trim()
  if (!hint) {
    return [...DEFAULT_ALIGO_OUTBOUND_IPS]
  }
  return [
    ...new Set(
      hint
        .split(/[\s,;|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]
}
