import { describe, expect, it } from 'vitest'
import { resolveAdvisorHeroDisplay } from './resolveAdvisorHeroDisplay'

const base = {
  displayName: '박성용',
  gaName: '영진에셋',
  teamName: '테스트팀',
  titleLabel: null as string | null,
}

describe('resolveAdvisorHeroDisplay', () => {
  it('uses fallback when hero fields are unset (null)', () => {
    const r = resolveAdvisorHeroDisplay({
      ...base,
      heroDisplayTitle: null,
      heroDisplaySubtitle: null,
      heroDisplayEyebrow: null,
    })
    expect(r.heroTitleLine).toBe('박성용 FC')
    expect(r.heroSubtitleLine).toBe('영진에셋 · 테스트팀')
  })

  it('hides lines when user saved empty string', () => {
    const r = resolveAdvisorHeroDisplay({
      ...base,
      heroDisplayTitle: '',
      heroDisplaySubtitle: '',
      heroDisplayEyebrow: '',
    })
    expect(r.heroTitleLine).toBeNull()
    expect(r.heroSubtitleLine).toBeNull()
    expect(r.heroEyebrowLine).toBeNull()
  })

  it('honorific unset uses FC in auto title, empty honorific omits suffix', () => {
    expect(resolveAdvisorHeroDisplay({ ...base, heroDisplayTitle: null }).heroTitleLine).toBe('박성용 FC')
    expect(
      resolveAdvisorHeroDisplay({ ...base, heroDisplayTitle: null, titleLabel: '' }).heroTitleLine,
    ).toBe('박성용')
  })
})
