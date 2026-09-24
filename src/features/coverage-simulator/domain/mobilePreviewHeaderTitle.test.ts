import { describe, expect, it } from 'vitest'
import { mobilePreviewHeaderTitle } from './mobilePreviewHeaderTitle'

describe('mobilePreviewHeaderTitle', () => {
  it('strips trailing 시나리오 for system titles', () => {
    expect(mobilePreviewHeaderTitle('암 치료 시나리오')).toBe('암 치료')
  })

  it('keeps custom template names', () => {
    expect(mobilePreviewHeaderTitle('김OO 맞춤 플랜')).toBe('김OO 맞춤 플랜')
  })

  it('handles empty', () => {
    expect(mobilePreviewHeaderTitle('  ')).toBe('시나리오')
  })
})
