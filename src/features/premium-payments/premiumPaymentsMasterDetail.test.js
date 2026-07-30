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

describe('card payment compact + master-detail contracts', () => {
  it('PaymentCardForm keeps required mark on the same label line', () => {
    const form = read('components/PaymentCardForm.tsx')
    assert.match(form, /premium-payments-field__label/)
    assert.match(form, /카드 소유주[\s\S]*premium-payments-required/)
    assert.match(form, /premium-payments-form__card-number-row/)
  })

  it('CollectionTargetForm keeps 보험회사 * on one label line', () => {
    const form = read('components/CollectionTargetForm.tsx')
    assert.match(form, /premium-payments-field__label/)
    assert.match(form, /보험회사[\s\S]*premium-payments-required/)
    assert.doesNotMatch(form, /PENDING|PAUSED|처리 필요/)
  })

  it('uses dedicated dialog presets instead of largeForm', () => {
    const dialog = read('components/CardPaymentFormDialog.tsx')
    assert.match(dialog, /panelPreset=\{size === 'contract' \? 'collectionTarget' : 'cardPayment'\}/)
    assert.doesNotMatch(dialog, /largeForm/)
    assert.match(dialog, /premium-payments-dialog__header/)
    assert.match(dialog, /premium-payments-dialog__footer/)
  })

  it('section headers own create actions', () => {
    const cards = read('components/PaymentCardsSection.tsx')
    const targets = read('components/CollectionTargetsSection.tsx')
    assert.match(cards, /카드정보 등록/)
    assert.match(cards, /premium-payments-section__header/)
    assert.match(targets, /수납 대상 추가/)
    assert.doesNotMatch(read('pages/customer/CustomerPremiumPaymentsBody.tsx'), /top-actions/)
  })

  it('shares CustomerCardPaymentPanels between customer and overview', () => {
    assert.match(read('pages/customer/CustomerPremiumPaymentsBody.tsx'), /CustomerCardPaymentPanels/)
    assert.match(read('pages/overview/PremiumPaymentsOverviewBody.tsx'), /CustomerCardPaymentPanels/)
    assert.match(read('pages/overview/PremiumPaymentsOverviewBody.tsx'), /PremiumPaymentsCustomerSidebar/)
  })

  it('overview uses customerId query selection and customer workspace link', () => {
    const page = read('pages/PremiumPaymentsOverviewPage.tsx')
    assert.match(page, /customerId/)
    assert.match(page, /setSearchParams/)
    assert.match(page, /premium-payments/)
    assert.match(page, /buildCustomerWorkspacePath/)
  })

  it('overview API mapping does not decrypt all card numbers', () => {
    const service = readFileSync(join(root, 'server/lib/cardPaymentService.js'), 'utf8')
    const overviewSlice = service.slice(service.indexOf('listCardPaymentContractsOverview'))
    assert.match(overviewSlice, /includeCardNumber:\s*false/)
  })
})
