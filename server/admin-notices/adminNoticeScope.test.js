import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertGaAdminOwnsNotice,
  resolveNoticeAudienceForWrite,
  ADMIN_NOTICE_AUDIENCE_GA,
  ADMIN_NOTICE_AUDIENCE_GLOBAL,
} from './adminNoticeScope.js'

describe('adminNoticeScope', () => {
  it('SUPER_ADMIN writes GLOBAL notices without ga_id', () => {
    const audience = resolveNoticeAudienceForWrite('SUPER_ADMIN', 99, { ga_id: 1 })
    assert.equal(audience.audienceScope, ADMIN_NOTICE_AUDIENCE_GLOBAL)
    assert.equal(audience.gaId, null)
  })

  it('GA_ADMIN writes GA notices with session ga_id only', () => {
    const audience = resolveNoticeAudienceForWrite('GA_ADMIN', 15, { ga_id: 99 })
    assert.equal(audience.audienceScope, ADMIN_NOTICE_AUDIENCE_GA)
    assert.equal(audience.gaId, 15)
  })

  it('GA_ADMIN cannot access another GA notice', () => {
    assert.throws(
      () =>
        assertGaAdminOwnsNotice(
          { audienceScope: ADMIN_NOTICE_AUDIENCE_GA, gaId: 14 },
          15,
        ),
      /notice_forbidden/,
    )
  })

  it('GA_ADMIN can access own GA notice', () => {
    assertGaAdminOwnsNotice({ audienceScope: ADMIN_NOTICE_AUDIENCE_GA, gaId: 15 }, 15)
  })
})
