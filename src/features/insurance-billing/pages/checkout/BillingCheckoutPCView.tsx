import type { BillingCheckoutViewProps } from './billingCheckoutViewProps'
import {
  CheckoutCouponSection,
  CheckoutPaymentMethodSection,
  CheckoutPlanSection,
  CheckoutStatusBanner,
  CheckoutSummaryPanel,
} from './BillingCheckoutSections'

export default function BillingCheckoutPCView(props: BillingCheckoutViewProps) {
  return (
    <main className="insurance-billing-page billing-checkout-page billing-checkout-page--pc">
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
            <div className="billing-checkout-layout billing-checkout-layout--pc">
              <div className="billing-checkout-layout__main">
                <CheckoutPlanSection props={props} />
                <CheckoutCouponSection props={props} />
                <CheckoutPaymentMethodSection props={props} />
              </div>
              <aside className="billing-checkout-layout__aside">
                <CheckoutSummaryPanel props={props} />
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
