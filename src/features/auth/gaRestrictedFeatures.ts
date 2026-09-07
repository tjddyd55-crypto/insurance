/**
 * GA 미소속(공용 GENERAL) 사용자가 GA 전용 기능에 접근할 때 표시할 안내 SSOT.
 * 소속 판별은 `isPublicGeneralAccount` 역논리 — 가입 시 코드 입력 여부가 아닌 현재 세션 GA 소속.
 */

export type GaRestrictedFeatureKey =
  | 'application'
  | 'insurer-newsletter'
  | 'loss-adjuster-newsletter'
  | 'loss-adjuster-board'
  | 'insurance-contacts'
  | 'generic'

export type GaRestrictedFeatureCopy = {
  title: string
  body: string
  helper: string
}

const SHARED_TITLE = 'GA 소속 사용자 전용 기능입니다'
const SHARED_HELPER = 'GA 등록코드로 소속이 확인되면 해당 기능을 이용할 수 있습니다.'

export const GA_RESTRICTED_FEATURE_COPY: Record<GaRestrictedFeatureKey, GaRestrictedFeatureCopy> = {
  application: {
    title: SHARED_TITLE,
    body: '신청서 기능은 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
  'insurer-newsletter': {
    title: SHARED_TITLE,
    body: '원수사 소식지는 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
  'loss-adjuster-newsletter': {
    title: SHARED_TITLE,
    body: '손해사정사 소식지는 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
  'loss-adjuster-board': {
    title: SHARED_TITLE,
    body: '손해사정사 게시판은 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
  'insurance-contacts': {
    title: SHARED_TITLE,
    body: '원수사 연락처는 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
  generic: {
    title: SHARED_TITLE,
    body: '이 기능은 소속 GA에서 보험 CRM을 도입한 경우 이용할 수 있습니다.',
    helper: SHARED_HELPER,
  },
}

function normalizePathname(pathname: string): string {
  const base = pathname.split('?')[0]?.trim() ?? ''
  if (!base) {
    return ''
  }
  return base.endsWith('/') && base.length > 1 ? base.replace(/\/+$/, '') : base
}

/** 메뉴/직접 URL `from` path → 기능별 안내 문구 키 */
export function resolveGaRestrictedFeatureFromPath(
  path: string | null | undefined,
): GaRestrictedFeatureKey {
  const normalized = normalizePathname(String(path ?? ''))
  if (!normalized) {
    return 'generic'
  }
  if (normalized === '/form/create' || normalized.startsWith('/form/')) {
    return 'application'
  }
  if (normalized === '/application' || normalized.startsWith('/application/')) {
    return 'application'
  }
  if (normalized === '/portal/newsletters' || normalized.startsWith('/portal/newsletters/')) {
    return 'insurer-newsletter'
  }
  if (normalized === '/portal/adjuster-news' || normalized.startsWith('/portal/adjuster-news/')) {
    return 'loss-adjuster-newsletter'
  }
  if (normalized === '/insurance/contacts' || normalized.startsWith('/insurance/contacts/')) {
    return 'insurance-contacts'
  }
  if (normalized.startsWith('/portal/boards/')) {
    return 'loss-adjuster-board'
  }
  return 'generic'
}

export function getGaRestrictedFeatureCopy(
  feature: GaRestrictedFeatureKey,
): GaRestrictedFeatureCopy {
  return GA_RESTRICTED_FEATURE_COPY[feature] ?? GA_RESTRICTED_FEATURE_COPY.generic
}
