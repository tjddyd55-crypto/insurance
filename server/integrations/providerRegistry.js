/**
 * 서비스 연동 제공자 레지스트리.
 * 메뉴는 하나이고, 새 제공자는 이 목록에만 추가한다.
 */

export const SERVICE_PROVIDERS = [
  {
    key: 'google_calendar',
    group: 'google',
    groupLabel: 'Google',
    name: 'Google Calendar',
    kind: 'oauth',
    env: ['GOOGLE_OAUTH_CLIENT_ID'],
    description: '일정을 Google 캘린더와 맞출 준비입니다.',
  },
  {
    key: 'google_drive',
    group: 'google',
    groupLabel: 'Google',
    name: 'Google Drive',
    kind: 'oauth',
    env: ['GOOGLE_OAUTH_CLIENT_ID'],
    description: '파일을 Google Drive와 맞출 준비입니다.',
  },
  {
    key: 'google_gmail',
    group: 'google',
    groupLabel: 'Google',
    name: 'Gmail',
    kind: 'future',
    env: [],
    description: 'Gmail 연동은 아직 열리지 않았습니다.',
  },
  {
    key: 'naver_calendar',
    group: 'naver',
    groupLabel: 'Naver',
    name: 'Naver Calendar',
    kind: 'oauth',
    env: ['NAVER_OAUTH_CLIENT_ID'],
    description: '일정을 네이버 캘린더와 맞출 준비입니다.',
  },
  {
    key: 'aligo_sms',
    group: 'aligo',
    groupLabel: 'Aligo',
    name: '알리고 문자',
    kind: 'aligo',
    env: [],
    description: 'CRM 단체·마케팅 문자 연동입니다. 운영 인증문자와 저장소가 다릅니다.',
  },
  {
    key: 'ga_insurer_api',
    group: 'insurer',
    groupLabel: 'GA / 보험사',
    name: 'GA·보험사 API',
    kind: 'future',
    env: [],
    description: 'GA·보험사 API 연동은 아직 열리지 않았습니다.',
  },
  {
    key: 'nhis_hira',
    group: 'health',
    groupLabel: '건강보험 / 심평원',
    name: '건강보험·심평원',
    kind: 'future',
    env: [],
    description: '건강보험·심평원 연동은 아직 열리지 않았습니다.',
  },
]

/**
 * @param {string} key
 */
export function findServiceProvider(key) {
  return SERVICE_PROVIDERS.find((provider) => provider.key === key) ?? null
}

/**
 * @param {{ kind: string, env?: string[] }} definition
 * @param {Record<string, string | undefined>} env
 * @returns {'ready' | 'unconfigured'}
 */
export function resolveProviderAvailability(definition, env) {
  if (definition.kind === 'future') {
    return 'unconfigured'
  }
  if (definition.kind === 'oauth') {
    const configured = (definition.env ?? []).some((name) => String(env[name] ?? '').trim())
    return configured ? 'ready' : 'unconfigured'
  }
  return 'ready'
}

/**
 * @param {ReturnType<typeof resolveProviderAvailability>} availability
 * @param {'connected' | 'disconnected' | 'error' | null} stored
 * @returns {'connected' | 'disconnected' | 'error' | 'unconfigured'}
 */
export function resolveConnectionStatus(availability, stored) {
  if (availability === 'unconfigured') {
    return 'unconfigured'
  }
  if (stored === 'connected' || stored === 'error') {
    return stored
  }
  return 'disconnected'
}

/**
 * @param {{ configured?: boolean, isActive?: boolean, apiKeyMasked?: string | null, providerMisconfigured?: boolean }} settings
 * @returns {'connected' | 'disconnected' | 'error' | 'unconfigured'}
 */
export function mapAligoConnectionStatus(settings) {
  if (!settings) {
    return 'unconfigured'
  }
  if (settings.providerMisconfigured && !settings.configured) {
    return 'unconfigured'
  }
  if (!settings.configured) {
    return 'disconnected'
  }
  if (settings.apiKeyMasked === '********' || settings.isActive === false) {
    return 'error'
  }
  return 'connected'
}
