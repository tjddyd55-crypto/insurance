import { describe, expect, it } from 'vitest'
import { readNativeEmbedMode, shouldHideWorkspaceChromeForNativeEmbed } from './nativeAppEmbed'

describe('nativeAppEmbed', () => {
  const embedded = { __ONEFC_NATIVE_EMBED__: 'mobile-card' }

  it('hides chrome only for native-embedded /profile/mobile-card', () => {
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card', embedded)).toBe(true)
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card/', embedded)).toBe(true)
  })

  it('keeps chrome in a normal browser (no flag)', () => {
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card', {})).toBe(false)
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card', null)).toBe(false)
  })

  it('keeps chrome on other paths even when embedded', () => {
    expect(shouldHideWorkspaceChromeForNativeEmbed('/fc/some-slug', embedded)).toBe(false)
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile', embedded)).toBe(false)
    expect(shouldHideWorkspaceChromeForNativeEmbed('/consultation-leads', embedded)).toBe(false)
  })

  it('ignores unknown or non-string flag values', () => {
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card', { __ONEFC_NATIVE_EMBED__: 'other' })).toBe(false)
    expect(shouldHideWorkspaceChromeForNativeEmbed('/profile/mobile-card', { __ONEFC_NATIVE_EMBED__: true })).toBe(false)
    expect(readNativeEmbedMode({ __ONEFC_NATIVE_EMBED__: ' mobile-card ' })).toBe('mobile-card')
  })
})
