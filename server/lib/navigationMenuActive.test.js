import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getClaimTabParam,
  isCustomerNewsClaimTab,
  isClaimManagementClaimTab,
  matchClaimRequestsMenuPath,
} from '../../shared/navigationMenuActive.js'

const CUSTOMER_NEWS_PATH = '/claim-requests?claimTab=news-all'
const CLAIM_MANAGEMENT_PATH = '/claim-requests'

test('customer news menu — news-all and news-personal tabs', () => {
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=news-all', CUSTOMER_NEWS_PATH), true)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=news-personal', CUSTOMER_NEWS_PATH), true)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=news-all', CLAIM_MANAGEMENT_PATH), false)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '', CUSTOMER_NEWS_PATH), false)
})

test('claim management menu — inbox/claims/default only', () => {
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '', CLAIM_MANAGEMENT_PATH), true)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=inbox', CLAIM_MANAGEMENT_PATH), true)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=claims', CLAIM_MANAGEMENT_PATH), true)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=news-all', CLAIM_MANAGEMENT_PATH), false)
  assert.equal(matchClaimRequestsMenuPath('/claim-requests', '?claimTab=news-personal', CLAIM_MANAGEMENT_PATH), false)
})

test('customer workspace claim-requests maps to claim management menu', () => {
  assert.equal(
    matchClaimRequestsMenuPath('/customers/12/claim-requests', '', CLAIM_MANAGEMENT_PATH),
    true,
  )
  assert.equal(
    matchClaimRequestsMenuPath('/customers/12/claim-requests', '?claimTab=claims', CLAIM_MANAGEMENT_PATH),
    true,
  )
  assert.equal(
    matchClaimRequestsMenuPath('/customers/12/claim-requests', '?claimTab=news-all', CUSTOMER_NEWS_PATH),
    false,
  )
})

test('claim tab helpers', () => {
  assert.equal(isCustomerNewsClaimTab('news-all'), true)
  assert.equal(isCustomerNewsClaimTab('news-personal'), true)
  assert.equal(isClaimManagementClaimTab(''), true)
  assert.equal(isClaimManagementClaimTab('inbox'), true)
  assert.equal(getClaimTabParam('?claimTab=news-all'), 'news-all')
})
