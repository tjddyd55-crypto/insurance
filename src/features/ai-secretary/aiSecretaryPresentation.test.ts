import { describe, expect, it } from 'vitest'

import { isAiAssistantRoute, resolveAiPresentationMode } from './aiSecretaryPresentation'

describe('aiSecretaryPresentation', () => {
  it('detects ai-assistant route', () => {
    expect(isAiAssistantRoute('/ai-assistant')).toBe(true)
    expect(isAiAssistantRoute('/ai-assistant/foo')).toBe(true)
    expect(isAiAssistantRoute('/customers')).toBe(false)
  })

  it('full page on /ai-assistant desktop even when panel flag open', () => {
    const mode = resolveAiPresentationMode({
      pathname: '/ai-assistant',
      isMobile: false,
      canUse: true,
      panelOpen: true,
    })
    expect(mode).toBe('full_page')
  })

  it('side panel only on normal route with panel open', () => {
    expect(
      resolveAiPresentationMode({
        pathname: '/customers',
        isMobile: false,
        canUse: true,
        panelOpen: true,
      }),
    ).toBe('side_panel')
    expect(
      resolveAiPresentationMode({
        pathname: '/customers',
        isMobile: false,
        canUse: true,
        panelOpen: false,
      }),
    ).toBe('closed')
  })

  it('mobile uses full page only on ai route', () => {
    expect(
      resolveAiPresentationMode({
        pathname: '/ai-assistant',
        isMobile: true,
        canUse: true,
        panelOpen: false,
      }),
    ).toBe('full_page')
    expect(
      resolveAiPresentationMode({
        pathname: '/customers',
        isMobile: true,
        canUse: true,
        panelOpen: true,
      }),
    ).toBe('closed')
  })
})
