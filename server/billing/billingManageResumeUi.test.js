import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

test('manage panel exposes cancel scheduled resume UX', () => {
  const panel = read('src/features/insurance-billing/components/InsuranceBillingManagePanel.tsx')
  const page = read('src/features/insurance-billing/pages/BillingManagePage.tsx')
  const utils = read('src/features/insurance-billing/billingManageViewUtils.ts')

  assert.match(utils, /CANCEL_SCHEDULED: '자동결제 해지 예정'/)
  assert.match(utils, /AUTO_RENEW_ACTIVE: '자동결제 사용 중'/)
  assert.match(panel, /showResume = isActivePaid && autoRenewStatus === 'CANCEL_SCHEDULED'/)
  assert.match(panel, /showCancel = isActivePaid && autoRenewStatus === 'AUTO_RENEW_ACTIVE'/)
  assert.match(panel, /자동결제 다시 시작/)
  assert.match(panel, /insurance-billing-cancel-scheduled-notice/)
  assert.match(page, /다음 자동결제일:/)
  assert.match(page, /다음 결제금액:/)
  assert.match(page, /오늘 추가 결제는 없습니다/)
  assert.match(page, /resumeBillingSubscription/)
})
