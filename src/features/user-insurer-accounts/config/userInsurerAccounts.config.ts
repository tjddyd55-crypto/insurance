export type UserInsurerAccountCategory = 'LIFE' | 'NON_LIFE'

export const USER_INSURER_ACCOUNT_TABS: Array<{
  value: UserInsurerAccountCategory
  label: string
}> = [
  { value: 'LIFE', label: '생명보험' },
  { value: 'NON_LIFE', label: '손해보험' },
]

export const USER_INSURER_ACCOUNT_ADD_LABEL: Record<UserInsurerAccountCategory, string> = {
  LIFE: '+ 생명보험 계정 추가',
  NON_LIFE: '+ 손해보험 계정 추가',
}
