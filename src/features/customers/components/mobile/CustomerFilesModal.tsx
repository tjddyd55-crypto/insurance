import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import StorageWorkspace from '../../../storage/components/StorageWorkspace'

type CustomerFilesModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerFilesModal({ customerId, onClose }: CustomerFilesModalProps) {
  const { token } = useAuth()

  return (
    <div className="mobile-modal-overlay" role="dialog" aria-modal="true" aria-label="고객 파일" onClick={onClose}>
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
          <span>고객 파일</span>
        </div>
        <div className="mobile-modal-body">
          <div className="mobile-modal-content">
            {token?.trim() ? (
              <StorageWorkspace token={token} customerId={customerId} title="" subtitle={undefined} variant="mobile" />
            ) : (
              <div style={{ padding: 16 }}>로그인이 필요합니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
