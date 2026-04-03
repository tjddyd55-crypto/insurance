import { useNavigate } from 'react-router-dom'

export function PageBackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="page-back-btn"
      onClick={() => navigate(-1)}
      aria-label="뒤로 가기"
    >
      ←
    </button>
  )
}
