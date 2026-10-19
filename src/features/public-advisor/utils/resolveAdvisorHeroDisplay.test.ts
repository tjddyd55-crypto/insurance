import { describe, expect, it } from 'vitest'
import { resolveAdvisorHeroDisplay } from './resolveAdvisorHeroDisplay'

describe('resolveAdvisorHeroDisplay', () => {
  it('shows only saved text without fallback', () => {
    const r = resolveAdvisorHeroDisplay({
      heroDisplayEyebrow: 'ONE FC',
      heroDisplayTitle: '박성용 FC',
      heroDisplaySubtitle: '영진에셋 · 팀장',
    })
    expect(r.heroEyebrowLine).toBe('ONE FC')
    expect(r.heroTitleLine).toBe('박성용 FC')
    expect(r.heroSubtitleLine).toBe('영진에셋 · 팀장')
  })

  it('hides slot when visibility is false but keeps text in storage', () => {
    const r = resolveAdvisorHeroDisplay({
      heroDisplayEyebrow: 'ONE FC',
      heroDisplayEyebrowVisible: false,
      heroDisplayTitle: '박성용 FC',
      heroDisplayTitleVisible: true,
    })
    expect(r.heroEyebrowLine).toBeNull()
    expect(r.heroTitleLine).toBe('박성용 FC')
  })

  it('empty text is not shown even when visible', () => {
    const r = resolveAdvisorHeroDisplay({
      heroDisplayEyebrow: '   ',
      heroDisplayEyebrowVisible: true,
    })
    expect(r.heroEyebrowLine).toBeNull()
  })
})
