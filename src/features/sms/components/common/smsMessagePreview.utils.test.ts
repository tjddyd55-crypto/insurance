import { describe, expect, it } from 'vitest'
import { calculateSmsMessageMeta } from '../../utils/smsMessageMeta'
import { resolveSmsPhonePreviewMessage } from './smsMessagePreview.utils'

describe('resolveSmsPhonePreviewMessage', () => {
  it('shows empty fallback when message and meta preview are blank', () => {
    const result = resolveSmsPhonePreviewMessage({
      message: '   ',
      emptyMessage: '내용을 입력하세요',
    })
    expect(result.isEmpty).toBe(true)
    expect(result.emptyMessage).toBe('내용을 입력하세요')
  })

  it('prefers meta.previewText over raw message', () => {
    const meta = calculateSmsMessageMeta({
      body: 'hello',
      isAdvertisement: false,
      previewSubstitution: { mode: 'preserve' },
    })
    const result = resolveSmsPhonePreviewMessage({
      message: 'ignored',
      meta,
    })
    expect(result.isEmpty).toBe(false)
    expect(result.text).toBe(meta.previewText)
    expect(result.typeLabel).toBe(meta.typeLabel)
  })

  it('keeps line breaks in preview text', () => {
    const body = '첫 줄\n둘째 줄'
    const meta = calculateSmsMessageMeta({
      body,
      isAdvertisement: false,
      previewSubstitution: { mode: 'preserve' },
    })
    const result = resolveSmsPhonePreviewMessage({ meta })
    expect(result.text).toContain('\n')
    expect(result.text).toBe(meta.previewText)
  })

  it('falls back to message prop when meta is absent', () => {
    const result = resolveSmsPhonePreviewMessage({ message: '직접 본문' })
    expect(result.text).toBe('직접 본문')
    expect(result.typeLabel).toBe('단문(SMS)')
  })
})
