import { FormButton } from '../../../components/form'

export type CustomerWorkspaceActionsVariant = 'mobile' | 'pc'

export type CustomerWorkspaceActionsProps = {
  variant: CustomerWorkspaceActionsVariant
  customerId: number
  carFeatureEnabled: boolean
  gaExcelEnabled: boolean
  onOpenFilesModal: (customerId: number) => void
  onOpenConsultationsModal: (customerId: number) => void
  onOpenAutoModal: (customerId: number) => void
  onOpenGaModal: (customerId: number) => void
  onOpenPersonalMessage: (customerId: number) => void
  onOpenClaims: (customerId: number) => void
}

export function CustomerWorkspaceActions({
  variant,
  customerId,
  carFeatureEnabled,
  gaExcelEnabled,
  onOpenFilesModal,
  onOpenConsultationsModal,
  onOpenAutoModal,
  onOpenGaModal,
  onOpenPersonalMessage,
  onOpenClaims,
}: CustomerWorkspaceActionsProps) {
  if (variant === 'mobile') {
    return (
      <div className="customer-detail-feature-actions customer-detail-feature-actions--mobile-priority">
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-mobile-action-btn"
          onClick={() => onOpenFilesModal(customerId)}
        >
          <span className="customer-mobile-action-btn__icon" aria-hidden>
            📁
          </span>
          <span className="customer-mobile-action-btn__text">고객 파일</span>
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-mobile-action-btn"
          onClick={() => onOpenConsultationsModal(customerId)}
        >
          <span className="customer-mobile-action-btn__icon" aria-hidden>
            💬
          </span>
          <span className="customer-mobile-action-btn__text">상담 내역</span>
        </FormButton>
        {carFeatureEnabled ? (
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary customer-mobile-action-btn"
            onClick={() => onOpenAutoModal(customerId)}
          >
            <span className="customer-mobile-action-btn__icon" aria-hidden>
              📝
            </span>
            <span className="customer-mobile-action-btn__text">자동차 신청서</span>
          </FormButton>
        ) : null}
        {gaExcelEnabled ? (
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary customer-mobile-action-btn"
            onClick={() => onOpenGaModal(customerId)}
          >
            <span className="customer-mobile-action-btn__icon" aria-hidden>
              📊
            </span>
            <span className="customer-mobile-action-btn__text">GA 데이터 보기</span>
          </FormButton>
        ) : null}
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-mobile-action-btn"
          onClick={() => onOpenPersonalMessage(customerId)}
        >
          <span className="customer-mobile-action-btn__icon" aria-hidden>
            ✉️
          </span>
          <span className="customer-mobile-action-btn__text">개인메시지</span>
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-mobile-action-btn"
          onClick={() => onOpenClaims(customerId)}
        >
          <span className="customer-mobile-action-btn__icon" aria-hidden>
            📋
          </span>
          <span className="customer-mobile-action-btn__text">청구</span>
        </FormButton>
      </div>
    )
  }

  return (
    <div className="customer-detail-feature-actions customer-workspace-action-bar">
      <FormButton
        htmlType="button"
        variant="secondary"
        className="button button--secondary customer-workspace-action-button"
        onClick={() => onOpenFilesModal(customerId)}
      >
        고객 파일
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        className="button button--secondary customer-workspace-action-button"
        onClick={() => onOpenConsultationsModal(customerId)}
      >
        상담 내역
      </FormButton>
      {carFeatureEnabled ? (
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-workspace-action-button"
          onClick={() => onOpenAutoModal(customerId)}
        >
          자동차 신청서
        </FormButton>
      ) : null}
      {gaExcelEnabled ? (
        <FormButton
          htmlType="button"
          variant="secondary"
          className="button button--secondary customer-workspace-action-button"
          onClick={() => onOpenGaModal(customerId)}
        >
          GA 데이터 보기
        </FormButton>
      ) : null}
    </div>
  )
}
