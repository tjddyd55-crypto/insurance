import type { BillingCheckoutViewProps } from './billingCheckoutViewProps'
import {
  CheckoutCouponSection,
  CheckoutPaymentMethodSection,
  CheckoutPlanSection,
  CheckoutStatusBanner,
  CheckoutSummaryPanel,
} from './BillingCheckoutSections'

export default function BillingCheckoutMobileView(props: BillingCheckoutViewProps) {
  return (
    <main className="insurance-billing-page billing-checkout-page billing-checkout-page--mobile">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-page__title">
          <h1>ONE FC 시작하기</h1>
          <p>요금제와 할인 혜택을 확인한 후 결제를 진행해 주세요.</p>
        </div>
        {props.loading ? <p className="insurance-billing-plan-note">불러오는 중...</p> : null}
        {props.summaryLoadError && !props.summary ? (
          <p className="insurance-billing-error">{props.summaryLoadError}</p>
        ) : null}
        {props.error ? <p className="insurance-billing-error">{props.error}</p> : null}
        {!props.loading && props.summary ? (
          <>
            <CheckoutStatusBanner props={props} />
            <div className="billing-checkout-layout billing-checkout-layout--mobile">
              <CheckoutPlanSection props={props} />
              <CheckoutCouponSection props={props} />
              <CheckoutPaymentMethodSection props={props} />
              <CheckoutSummaryPanel props={props} />
            </div>
            {!props.isActiveEntitled ? (
              <div className="billing-checkout-mobile-cta-bar">
                <button
                  type="button"
                  className="insurance-billing-cta"
                  disabled={props.ctaDisabled}
                  onClick={props.onPrimaryAction}
                >
                  {props.submitting ? '처리 중...' : props.ctaLabel}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}
