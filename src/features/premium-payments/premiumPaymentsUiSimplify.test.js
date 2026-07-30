import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const feature = join(root, 'src/features/premium-payments')

function read(rel) {
  return readFileSync(join(feature, rel), 'utf8')
}

describe('card payment UI simplification contracts', () => {
  it('removes duplicate description under 카드 수납 title', () => {
    assert.doesNotMatch(read('pages/customer/CustomerPremiumPaymentsPCView.tsx'), /카드로 직접 수납/)
    assert.doesNotMatch(read('pages/customer/CustomerPremiumPaymentsMobileView.tsx'), /카드로 직접 수납/)
    assert.doesNotMatch(read('pages/customer/CustomerPremiumPaymentsBody.tsx'), /카드로 직접 수납/)
    assert.doesNotMatch(read('pages/overview/PremiumPaymentsOverviewBody.tsx'), /카드로 직접 수납/)
  })

  it('customer detail has no completion/status UI columns or handlers', () => {
    const body = read('pages/customer/CustomerPremiumPaymentsBody.tsx')
    const page = read('pages/CustomerPremiumPaymentsPage.tsx')
    const hook = read('hooks/useCustomerPremiumPaymentsState.ts')
    assert.doesNotMatch(body, /최근 처리일|처리 완료|처리 필요|monthStatusLabel|onConfirmComplete|onConfirmReopen/)
    assert.doesNotMatch(page, /onConfirmComplete|onConfirmReopen|처리 완료/)
    assert.doesNotMatch(hook, /markComplete|markReopen|completeCardPaymentContract|reopenCardPaymentContract/)
    assert.match(body, /카드정보 등록/)
    assert.match(body, /수납 대상 추가/)
    assert.match(body, /CardPaymentRowActions/)
  })

  it('collection target form has no status field', () => {
    const form = read('components/CollectionTargetForm.tsx')
    assert.doesNotMatch(form, /PENDING|PAUSED|처리 필요|보류/)
    assert.doesNotMatch(form, /label:\s*'처리|FormSelect[\s\S]*status/)
    assert.doesNotMatch(form, /value\.status|contractForm\.status/)
    assert.match(form, /보험회사/)
    assert.match(form, /연결 안 함/)
  })

  it('uses ConfirmDialog SSOT delete copy', () => {
    const page = read('pages/CustomerPremiumPaymentsPage.tsx')
    assert.match(page, /useConfirmDialog/)
    assert.match(page, /카드정보를 삭제할까요\?/)
    assert.match(page, /등록된 카드정보가 삭제됩니다\./)
    assert.match(page, /수납 대상을 삭제할까요\?/)
    assert.match(page, /카드 수납 대상이 삭제됩니다\./)
  })

  it('overview removes status summary and complete/reopen actions', () => {
    const body = read('pages/overview/PremiumPaymentsOverviewBody.tsx')
    const page = read('pages/PremiumPaymentsOverviewPage.tsx')
    const hook = read('hooks/usePremiumPaymentsOverviewState.ts')
    assert.doesNotMatch(body, /처리 필요|처리 완료|최근 처리|monthStatusLabel|onConfirmComplete/)
    assert.doesNotMatch(page, /onConfirmComplete|onConfirmReopen/)
    assert.doesNotMatch(hook, /markComplete|markReopen|setStatus/)
    assert.match(body, /CardPaymentRowActions/)
  })

  it('keeps server complete/reopen API registration', () => {
    const api = readFileSync(join(root, 'server/registerCardPaymentApi.js'), 'utf8')
    assert.match(api, /\/complete/)
    assert.match(api, /\/reopen/)
  })
})
