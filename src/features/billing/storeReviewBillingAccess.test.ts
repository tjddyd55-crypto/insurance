import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('storeReviewBillingAccess wiring', () => {
  it('exposes PLAY_REVIEW subject and review access helpers', () => {
    const src = read('src/features/billing/storeReviewBillingAccess.ts')
    assert.match(src, /STORE_REVIEW_GA_CODE = 'PLAY_REVIEW'/)
    assert.match(src, /isBillingUiVisibleForUser/)
    assert.match(src, /canReviewTenantStartCheckoutPayment/)
    assert.match(src, /VITE_BILLING_REVIEW_ACCESS_ENABLED/)
  })

  it('wires FreeLaunchBillingGuard and Profile to review-aware visibility', () => {
    const guard = read('src/features/billing/FreeLaunchBillingGuard.tsx')
    assert.match(guard, /isBillingUiHiddenForUser/)
    assert.match(guard, /useAuth/)

    const profile = read('src/features/auth/pages/ProfilePage.tsx')
    assert.match(profile, /isBillingUiVisibleForUser/)
    assert.match(profile, /ProfileBillingSection/)

    const profileBilling = read('src/features/auth/pages/profile/ProfileBillingSection.tsx')
    assert.match(profileBilling, /결제 및 구독/)
    assert.match(profileBilling, /resolveInsuranceBillingProfileEntryPath/)
    assert.doesNotMatch(profileBilling, /Toss 결제 QA/)

    const landing = read('src/features/insurance-billing/insuranceBillingLanding.ts')
    assert.match(landing, /\/billing\/checkout/)
    assert.match(landing, /\/billing\/manage/)

    const menu = read('src/features/dashboard/gaTenantMenu.ts')
    assert.match(menu, /isBillingUiVisibleForUser/)
    assert.match(menu, /구독 및 결제/)

    const checkout = read('src/features/insurance-billing/pages/BillingCheckoutPage.tsx')
    assert.doesNotMatch(checkout, /reviewCheckoutOpen/)
    assert.doesNotMatch(checkout, /canReviewTenantStartCheckoutPayment/)
  })
})
