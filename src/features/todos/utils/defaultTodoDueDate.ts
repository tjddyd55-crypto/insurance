import { defaultNewItemDate } from '../../../utils/dateInput'

/**
 * 새 할 일 작성 폼의 처음 날짜.
 * 달력에서 고른 날(explicit)이 있으면 그대로, 없으면 오늘(Asia/Seoul).
 * 상담·메모·목록의 빈 추가는 explicit 를 넘기지 않으므로 오늘이다.
 * 본문 키워드(오늘/내일/모레)는 자동으로 넣지 않고, 폼의 '날짜 제안'으로만 반영한다.
 * 수정 모드에는 쓰지 않는다(저장된 날짜·빈 값을 그대로 둔다).
 */
export function initialCreateDueDate(params: {
  explicit?: string | null
  now?: Date
} = {}): string {
  return defaultNewItemDate(params.explicit, params.now ?? new Date())
}
