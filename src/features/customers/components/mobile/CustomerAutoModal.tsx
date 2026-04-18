import { FormButton } from '../../../../components/form'
import { ApplicationFormPage } from '../../../application/pages/ApplicationFormPage'

type CustomerAutoModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerAutoModal({ customerId, onClose }: CustomerAutoModalProps) {
  return (
    <div className="mobile-modal-overlay" role="dialog" aria-modal="true" aria-label="자동차 신청서" onClick={onClose}>
      <style>{`
        .mobile-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
        }
        .mobile-modal {
          position: fixed;
          inset: 0;
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          display: flex;
          flex-direction: column;
          padding-bottom: env(safe-area-inset-bottom);
          animation: slideUp 0.25s ease;
        }
        .mobile-modal-header {
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--app-bg, #0b0f14);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mobile-modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .mobile-modal-content {
          background: var(--app-bg, #0b0f14);
          color: var(--app-text, #fff);
          min-height: 100%;
        }
        .mobile-modal button {
          min-height: 44px;
        }
        @keyframes slideUp {
          from {
            transform: translateY(20%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <FormButton htmlType="button" variant="action" className="mobile-btn" onClick={onClose}>
            닫기
          </FormButton>
          <span>자동차 신청서</span>
        </div>
        <div className="mobile-modal-body">
          <div className="mobile-modal-content">
            {/* ApplicationFormPage는 라우트 기반 customerId를 사용하므로, 모달에서는 식별자 표시만 유지 */}
            <div style={{ padding: '8px 16px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              고객 ID: {customerId}
            </div>
            <ApplicationFormPage />
          </div>
        </div>
      </div>
    </div>
  )
}
