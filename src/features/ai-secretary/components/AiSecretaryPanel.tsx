import { useAiSecretary } from '../context/AiSecretaryContext'
import AiSecretaryWorkspace from './AiSecretaryWorkspace'
import './ai-secretary-panel.css'

export default function AiSecretaryPanel() {
  const { isOpen, close, isMobile, canUse } = useAiSecretary()

  if (!canUse || isMobile || !isOpen) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className="ai-secretary-panel-backdrop"
        aria-label="AI 비서 닫기"
        onClick={close}
      />
      <aside className="ai-secretary-panel" aria-label="ONE FC AI 비서">
        <AiSecretaryWorkspace variant="panel" onClose={close} />
      </aside>
    </>
  )
}
