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

describe('card payment compact row alignment + policy copy', () => {
  it('CollectionTargetsSection uses InlineCopyValue for policy number', () => {
    const section = read('components/CollectionTargetsSection.tsx')
    assert.match(section, /InlineCopyValue/)
    assert.match(section, /emptyLabel="증권번호 없음"/)
    assert.match(section, /onCopyPolicyNumber/)
  })

  it('InlineCopyValue hides copy when value empty', () => {
    const comp = read('components/InlineCopyValue.tsx')
    assert.match(comp, /emptyLabel/)
    assert.match(comp, /value\?\.trim/)
    assert.match(comp, /복사/)
    assert.match(comp, /premium-payments-inline-value__copy/)
  })

  it('PaymentCardsSection reuses InlineCopyValue', () => {
    assert.match(read('components/PaymentCardsSection.tsx'), /InlineCopyValue/)
  })

  it('row actions force horizontal nowrap', () => {
    const actions = read('components/CardPaymentRowActions.tsx')
    const css = read('premium-payments.css')
    assert.match(actions, /premium-payments-row-actions/)
    assert.match(css, /premium-payments-row-actions[\s\S]*flex-wrap:\s*nowrap/)
    assert.match(css, /premium-payments-card-table__col--actions[\s\S]*min-width:\s*128px/)
    assert.match(css, /premium-payments-table__col--actions[\s\S]*text-align:\s*center/)
    assert.match(css, /premium-payments-row-actions[\s\S]*justify-content:\s*center/)
  })

  it('amount and day cells share vertical center cell-inner', () => {
    const section = read('components/CollectionTargetsSection.tsx')
    const css = read('premium-payments.css')
    assert.match(section, /premium-payments-cell-inner--end/)
    assert.match(section, /premium-payments-cell-inner--center/)
    assert.match(section, /formatPremiumAmount/)
    assert.match(section, /formatPaymentDay/)
    assert.match(css, /\.premium-payments-cell-inner[\s\S]*align-items:\s*center/)
  })

  it('policy copy toast stays on shared clipboard helper path', () => {
    const hook = read('hooks/useCustomerPremiumPaymentsState.ts')
    assert.match(hook, /증권번호를 복사했습니다\./)
    assert.match(hook, /copyTextToClipboard/)
  })
})
