import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getBackNavigationBlock, isCarInsuranceMainHub } from '../../navigation/backNavigationPolicy'

export function PageBackButton() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const handleClick = () => {
    if (isCarInsuranceMainHub(pathname)) {
      navigate('/dashboard')
      return
    }
    const { shouldBlock, message } = getBackNavigationBlock(pathname, search)
    if (!shouldBlock) {
      navigate(-1)
      return
    }
    setConfirmMessage(message)
  }

  const handleConfirm = () => {
    setConfirmMessage(null)
    navigate(-1)
  }

  const handleCancel = () => {
    setConfirmMessage(null)
  }

  return (
    <>
      <button
        type="button"
        className="page-back-btn"
        onClick={handleClick}
        aria-label="뒤로 가기"
      >
        ←
      </button>
      {confirmMessage ? (
        <div className="modal-overlay" role="presentation" onClick={handleCancel}>
          <div
            className="modal app-exit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-back-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="page-back-confirm-title">{confirmMessage}</h3>
            <div className="modal-actions app-exit-modal__actions">
              <button type="button" className="modal-cancel" onClick={handleCancel}>
                취소
              </button>
              <button type="button" className="confirm" onClick={handleConfirm}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
