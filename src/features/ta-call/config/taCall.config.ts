export const TA_CALL_MIN_TARGET = 1
export const TA_CALL_MAX_TARGET = 50
export const TA_CALL_DEFAULT_TARGET = 10
export const TA_CALL_RECOMMENDED_TARGETS = [10, 20] as const

export const TA_CALL_EMPTY_MESSAGES = {
  noCustomers: '전화 대상 고객이 없습니다. 고객을 먼저 등록해 주세요.',
  noAdultEligible: '오늘 배정 가능한 성인 고객이 없습니다.',
  partialAssign: '전화 가능한 성인 고객 수가 목표보다 적어 가능한 인원만 배정되었습니다.',
  futureDay: '해당 날짜가 되면 자동으로 전화 대상이 생성됩니다.',
  preparing: '오늘의 TA 대상을 준비하고 있습니다.',
} as const
