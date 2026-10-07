import { useAiSecretary } from '../context/AiSecretaryContext'
import AiSecretaryWorkspace from './AiSecretaryWorkspace'
import './ai-secretary-panel.css'

export default function AiSecretaryPanel() {
  const { presentationMode, close, canUse } = useAiSecretary()

  if (!canUse || presentationMode !== 'side_panel') {
    return null
  }

  return (
    <aside className="ai-secretary-panel" aria-label="ONE FC AI 비서">
      <AiSecretaryWorkspace variant="panel" onClose={close} />
    </aside>
  )
}
