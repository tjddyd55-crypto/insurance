import { formatSeoulYmd } from './formatSeoulYmd'

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * 새 할 일 작성 폼의 처음 마감일.
 * 1) 호출한 쪽이 넘긴 날짜(달력에서 고른 날 등)가 있으면 그대로.
 * 2) 없으면 본문 키워드 제안(오늘/내일/모레) — 기존 규칙 유지.
 * 3) 그래도 없고 todayDefault 이면 오늘(Asia/Seoul) 날짜. 시간대 변환 없이 KST 날짜 문자열만 쓴다.
 * 수정 모드에는 쓰지 않는다(저장된 마감일·빈 값을 그대로 둔다).
 */
export function initialCreateDueDate(params: {
  explicit?: string | null
  suggested?: string | null
  todayDefault: boolean
  now?: Date
}): string {
  if (params.explicit && YMD.test(params.explicit)) return params.explicit
  if (params.suggested && YMD.test(params.suggested)) return params.suggested
  return params.todayDefault ? formatSeoulYmd(params.now ?? new Date()) : ''
}
