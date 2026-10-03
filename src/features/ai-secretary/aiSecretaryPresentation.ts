export const AI_ASSISTANT_ROUTE = '/ai-assistant'

export type AiPresentationMode = 'closed' | 'side_panel' | 'full_page'

export function isAiAssistantRoute(pathname: string): boolean {
  return pathname === AI_ASSISTANT_ROUTE || pathname.startsWith(`${AI_ASSISTANT_ROUTE}/`)
}

/**
 * Desktop presentation SSOT. Mobile uses full-page route only (no side panel).
 */
export function resolveAiPresentationMode(input: {
  pathname: string
  isMobile: boolean
  canUse: boolean
  panelOpen: boolean
}): AiPresentationMode {
  if (!input.canUse) {
    return 'closed'
  }
  if (input.isMobile) {
    return isAiAssistantRoute(input.pathname) ? 'full_page' : 'closed'
  }
  if (isAiAssistantRoute(input.pathname)) {
    return 'full_page'
  }
  if (input.panelOpen) {
    return 'side_panel'
  }
  return 'closed'
}
