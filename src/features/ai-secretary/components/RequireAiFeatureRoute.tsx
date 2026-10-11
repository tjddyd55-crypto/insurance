import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isAiFeatureVisible } from '../config/aiSecretaryUserUiGate'

type Props = {
  children: ReactNode
  fallbackPath?: string
}

/** Production 등 AI 비노출 환경에서 AI 라우트 직접 접근을 차단한다. */
export function RequireAiFeatureRoute({ children, fallbackPath = '/dashboard' }: Props) {
  if (!isAiFeatureVisible()) {
    return <Navigate to={fallbackPath} replace />
  }
  return <>{children}</>
}
