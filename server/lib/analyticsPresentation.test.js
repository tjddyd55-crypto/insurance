import assert from 'node:assert/strict'
import test from 'node:test'

/** src/features/analytics/analyticsLabels.ts 와 동기화 */
const ANALYTICS_METRIC_LABELS = [
  '전체 회원',
  '어제 접속한 회원',
  '최근 7일 접속한 회원',
  '신규 가입',
  '새 고객 등록',
  '신청서 생성',
  '팀 상담 메시지',
]

const ANALYTICS_BOARD_LABELS = [
  '등록된 GA',
  '전체 회원',
  '어제 접속한 회원',
  '최근 7일 접속한 회원',
  '신규 가입',
  '새 고객 등록',
  '신청서 생성',
  '팀 상담 메시지',
  '회원 수',
  '어제 접속',
  '7일 접속',
  '고객 등록',
  '상담 메시지',
  'GA별 현황',
  '오늘 현황',
  '자세히 보기',
]

const FORBIDDEN = ['DAU', 'WAU', 'analytics_events', 'snapshot', 'users.created_at']

test('analytics UI labels avoid developer terminology', () => {
  for (const label of [...ANALYTICS_METRIC_LABELS, ...ANALYTICS_BOARD_LABELS]) {
    for (const term of FORBIDDEN) {
      assert.equal(
        label.includes(term),
        false,
        `label "${label}" must not include "${term}"`,
      )
    }
  }
})
