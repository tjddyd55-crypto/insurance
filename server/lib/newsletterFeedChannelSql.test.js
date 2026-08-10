import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyNewsletterNewsChannel,
  isInsurerFeedEligiblePayload,
  sqlExcludeDynamicBoardFromInsurerFeed,
  sqlFeedChannelExtraGuards,
} from './newsletterFeedChannelSql.js'

describe('newsletter feed channel isolation', () => {
  it('classifies BOARD vs INSURER vs LOSS_ADJUSTER', () => {
    assert.equal(classifyNewsletterNewsChannel('BOARD'), 'BOARD')
    assert.equal(classifyNewsletterNewsChannel('INSURER'), 'INSURER')
    assert.equal(classifyNewsletterNewsChannel('LOSS_ADJUSTER'), 'LOSS_ADJUSTER')
    assert.equal(classifyNewsletterNewsChannel(''), 'INSURER')
  })

  it('excludes dynamic board posts even when newsChannel was wrongly INSURER', () => {
    assert.equal(
      isInsurerFeedEligiblePayload({
        newsChannel: 'INSURER',
        dynamicBoardSlug: 'test',
        insurerCode: 'BOARD',
        insurerName: '영진 · 홍길동',
        authorDisplayName: '영진 · 홍길동',
      }),
      false,
    )
  })

  it('keeps true insurer posts eligible', () => {
    assert.equal(
      isInsurerFeedEligiblePayload({
        newsChannel: 'INSURER',
        insurerCode: 'SAMSUNG',
        insurerName: '삼성생명',
      }),
      true,
    )
  })

  it('excludes LOSS_ADJUSTER and BOARD channel', () => {
    assert.equal(isInsurerFeedEligiblePayload({ newsChannel: 'LOSS_ADJUSTER' }), false)
    assert.equal(isInsurerFeedEligiblePayload({ newsChannel: 'BOARD', insurerCode: 'BOARD' }), false)
  })

  it('SQL exclude clause targets slug/board id/code/channel', () => {
    const sql = sqlExcludeDynamicBoardFromInsurerFeed('n')
    assert.match(sql, /dynamicBoardSlug/)
    assert.match(sql, /newsletterBoardId/)
    assert.match(sql, /insurerCode/)
    assert.match(sql, /newsChannel/)
    assert.doesNotMatch(sql, /insurerName/)
    assert.doesNotMatch(sql, /company_name_snapshot/)
  })

  it('keeps LOSS_ADJUSTER feed posts that carry newsletterBoardId', () => {
    assert.equal(sqlFeedChannelExtraGuards('LOSS_ADJUSTER', 'n'), '')
    assert.equal(sqlFeedChannelExtraGuards('loss_adjuster', ''), '')
    const insurerGuard = sqlFeedChannelExtraGuards('INSURER', 'n')
    assert.match(insurerGuard, /newsletterBoardId/)
    assert.equal(insurerGuard, sqlExcludeDynamicBoardFromInsurerFeed('n'))
  })
})
