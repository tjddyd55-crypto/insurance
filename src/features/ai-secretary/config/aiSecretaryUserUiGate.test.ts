import { describe, expect, it } from 'vitest'

import { resolveAiSecretaryUserUiEnabled } from './aiSecretaryUserUiGate'

describe('resolveAiSecretaryUserUiEnabled', () => {
  it('allows UI on vite dev', () => {
    expect(resolveAiSecretaryUserUiEnabled('onefc.platform-assets.com', true)).toBe(true)
  })

  it('blocks UI on official production host', () => {
    expect(resolveAiSecretaryUserUiEnabled('onefc.platform-assets.com', false)).toBe(false)
  })

  it('allows UI on railway dev host', () => {
    expect(resolveAiSecretaryUserUiEnabled('insurance-dev.up.railway.app', false)).toBe(true)
  })
})
