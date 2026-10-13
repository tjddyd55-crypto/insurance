import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filterGaAdminManageableNewsletterBoardRows } from './gaAdminNewsletterBoardListScope.js'
import { LOSS_ADJUSTER_SYSTEM_KEY } from './lossAdjusterNewsletterBoard.js'
import {
  GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL,
  SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL,
} from './newsletterBoardAdminSql.js'

const CHUNGHE_GA_ID = 2122
const YJASSET_GA_ID = 1

function row(partial) {
  return {
    id: partial.id,
    board_scope: 'ga',
    owner_ga_id: partial.owner_ga_id,
    system_key: partial.system_key ?? null,
    label: partial.label ?? 'board',
    is_deleted: false,
  }
}

describe('GA_ADMIN newsletter board list scope', () => {
  it('Case A — 청해지점: LOSS_ADJUSTER·타 GA 보드 제외, 자기 GA 동적 보드 없으면 []', () => {
    const fixture = [
      row({ id: 'loss-ch', owner_ga_id: CHUNGHE_GA_ID, system_key: LOSS_ADJUSTER_SYSTEM_KEY, label: '손해사정사 소식지' }),
      row({ id: 'yj-a', owner_ga_id: YJASSET_GA_ID, label: '영진서울중앙' }),
    ]
    const result = filterGaAdminManageableNewsletterBoardRows(fixture, CHUNGHE_GA_ID)
    assert.deepEqual(result, [])
  })

  it('Case B — 영진에셋: 자기 GA 동적 보드만, LOSS_ADJUSTER·청해 제외', () => {
    const fixture = [
      row({ id: 'loss-yj', owner_ga_id: YJASSET_GA_ID, system_key: LOSS_ADJUSTER_SYSTEM_KEY, label: '손해사정사 소식지' }),
      row({ id: 'a', owner_ga_id: YJASSET_GA_ID, label: '영진서울중앙' }),
      row({ id: 'b', owner_ga_id: YJASSET_GA_ID, label: '테스트' }),
      row({ id: 'ch', owner_ga_id: CHUNGHE_GA_ID, label: '청해 전용' }),
    ]
    const result = filterGaAdminManageableNewsletterBoardRows(fixture, YJASSET_GA_ID)
    assert.deepEqual(result.map((r) => r.id), ['a', 'b'])
    assert.ok(!result.some((r) => r.system_key === LOSS_ADJUSTER_SYSTEM_KEY))
  })

  it('Case C — SUPER_ADMIN 목록 SQL은 LOSS_ADJUSTER 제외 조건을 넣지 않는다', () => {
    assert.match(GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL, /LOSS_ADJUSTER/i)
    assert.match(GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL, /owner_ga_id\s*=\s*\$1/i)
    assert.doesNotMatch(SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL, /system_key.*LOSS_ADJUSTER/i)
  })
})
