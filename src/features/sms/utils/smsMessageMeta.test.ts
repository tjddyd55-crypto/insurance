import { describe, expect, it } from 'vitest'
import { SMS_AD_DISPLAY_NAME_PLACEHOLDER } from '../config/smsCompose.config'
import {
  calculateSmsMessageMeta,
  resolveSmsAdDisplayName,
} from './smsMessageMeta'

describe('resolveSmsAdDisplayName', () => {
  it('prefers saved settings value over user and organization names', () => {
    expect(
      resolveSmsAdDisplayName({
        savedAdDisplayName: '박성용',
        userDisplayName: '홍길동',
        organizationDisplayName: 'ONE FC',
      }),
    ).toBe('박성용')
  })

  it('falls back to user display name when saved value is empty', () => {
    expect(
      resolveSmsAdDisplayName({
        savedAdDisplayName: '',
        userDisplayName: '홍길동',
        organizationDisplayName: '영진에셋',
      }),
    ).toBe('홍길동')
  })

  it('returns null instead of defaulting to ONE FC', () => {
    expect(
      resolveSmsAdDisplayName({
        savedAdDisplayName: '',
        userDisplayName: '',
        organizationDisplayName: '',
      }),
    ).toBeNull()
  })
})

describe('calculateSmsMessageMeta advertisement preview', () => {
  it('builds preview with saved ad display name and opt-out footer', () => {
    const meta = calculateSmsMessageMeta({
      body: '안녕하세요.',
      isAdvertisement: true,
      adDisplayName: '박성용',
    })
    expect(meta.previewHeader).toBe('(광고)박성용')
    expect(meta.previewText).toContain('무료거부 0808811258')
    expect(meta.previewText).not.toContain('ONE FC')
    expect(meta.byteCount).toBeGreaterThan(calculateSmsMessageMeta({ body: '안녕하세요.' }).byteCount)
  })

  it('shows placeholder header and warning when ad display name is missing', () => {
    const meta = calculateSmsMessageMeta({
      body: '안녕하세요.',
      isAdvertisement: true,
      adDisplayName: null,
    })
    expect(meta.previewHeader).toBe(`(광고)${SMS_AD_DISPLAY_NAME_PLACEHOLDER}`)
    expect(meta.adDisplayNameMissing).toBe(true)
    expect(meta.adDisplayNameNotice).toMatch(/문자 설정/)
    expect(meta.previewText).not.toContain('ONE FC')
  })

  it('shows body only when advertisement checkbox is off', () => {
    const meta = calculateSmsMessageMeta({
      body: '안녕하세요.',
      isAdvertisement: false,
      adDisplayName: '박성용',
    })
    expect(meta.previewHeader).toBeNull()
    expect(meta.previewText).toBe('안녕하세요.')
  })
})
