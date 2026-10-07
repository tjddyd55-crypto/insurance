import AiSecretaryWorkspace from '../components/AiSecretaryWorkspace'
import { isAiSecretaryUserUiEnabled } from '../config/aiSecretaryUserUiGate'
import { AiSecretaryComingSoonPage } from './AiSecretaryComingSoonPage'

export default function AiSecretaryPage() {
  if (!isAiSecretaryUserUiEnabled()) {
    return <AiSecretaryComingSoonPage />
  }
  return <AiSecretaryWorkspace variant="page" />
}
