export type UserInsurerAccountCategory = 'LIFE' | 'NON_LIFE' | 'GENERAL'

export const USER_INSURER_ACCOUNT_TABS: Array<{
  value: UserInsurerAccountCategory
  label: string
}> = [
  { value: 'LIFE', label: '생명보험' },
  { value: 'NON_LIFE', label: '손해보험' },
  { value: 'GENERAL', label: '일반' },
]

/** 본인 계정관리 등 전체 카테고리 노출 화면 */
export const ALL_USER_INSURER_ACCOUNT_CATEGORIES: UserInsurerAccountCategory[] = [
  'LIFE',
  'NON_LIFE',
  'GENERAL',
]

/** 공유·외부 URL 계정관리 — 생명/손해만 노출 */
export const SHARED_USER_INSURER_ACCOUNT_CATEGORIES: UserInsurerAccountCategory[] = [
  'LIFE',
  'NON_LIFE',
]

export const USER_INSURER_ACCOUNT_ADD_LABEL: Record<UserInsurerAccountCategory, string> = {
  LIFE: '+ 생명보험 계정 추가',
  NON_LIFE: '+ 손해보험 계정 추가',
  GENERAL: '+ 일반 계정 추가',
}

/** 본인 계정관리 상단 toolbar — 일반 계정 추가 */
export const USER_INSURER_ACCOUNT_GENERAL_ADD_TOOLBAR_LABEL = '일반 계정 추가'

export const USER_INSURER_ACCOUNT_EMPTY_LABEL: Record<UserInsurerAccountCategory, string> = {
  LIFE: '등록된 계정 정보가 없습니다.',
  NON_LIFE: '등록된 계정 정보가 없습니다.',
  GENERAL: '등록된 일반 계정이 없습니다.',
}
