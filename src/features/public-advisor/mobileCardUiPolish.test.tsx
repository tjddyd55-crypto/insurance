/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdvisorConsultationPrivacyConsent } from './components/AdvisorConsultationPrivacyConsent'
import { AdvisorMobileCardThemePicker } from './components/AdvisorMobileCardThemePicker'
import { AdvisorPublicProfileView, type AdvisorPublicProfileViewModel } from './components/AdvisorPublicProfileView'
import { ADVISOR_PROFILE_THEMES } from './profileTheme'
import { advisorPublishToggleLabel } from './utils/advisorPublishToggleLabel'

/** t371u Part A — 모바일 명함 웹 UI 정리(§2–5) 구조 테스트. 실제 390/430px 측정은 PR 본문 참고. */
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'public-advisor.css'), 'utf8')
const pageSource = readFileSync(join(here, 'pages', 'MyPublicProfilePage.tsx'), 'utf8')

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  expect(m, `CSS rule ${selector}`).not.toBeNull()
  return m![2]
}

function parse(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

const MODEL: AdvisorPublicProfileViewModel = {
  displayName: '홍길동',
  profilePhotoUrl: null,
  affiliationLine: 'ONE FC',
  officeLine: '서울 중구 세종대로 110',
  headline: '든든한 보험 파트너',
  publicTags: ['실손보험', '자동차보험', '화재보험'],
  phoneNumber: '010-1234-5678',
  kakaoLink: '',
  allowConsultation: true,
  bio: '',
  businessCardFrontUrl: 'https://example.com/card.png',
  gallery: [],
  infoBlocks: [],
}

describe('§2 consultation privacy checkbox row', () => {
  it('renders checkbox + text as direct children of one label row', () => {
    const root = parse(
      renderToStaticMarkup(
        <AdvisorConsultationPrivacyConsent checked={false} onChange={() => {}} termsOpen={false} onTermsOpenChange={() => {}} />,
      ),
    )
    const label = root.querySelector('label.pap-consult-privacy__check')!
    expect(label).not.toBeNull()
    const kids = Array.from(label.children)
    expect(kids.map((k) => k.tagName)).toEqual(['INPUT', 'SPAN'])
    expect((kids[0] as HTMLInputElement).type).toBe('checkbox')
    expect(kids[1].className).toBe('pap-consult-privacy__label')
    expect(kids[1].textContent).toContain('개인정보 수집·이용 동의')
  })

  it('is a centered flex row with a 44px touch area that outranks the sheet label rule, without offset hacks', () => {
    const body = ruleBody('.pap-consult-privacy .pap-consult-privacy__check')
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/align-items:\s*center/)
    expect(body).toMatch(/min-height:\s*44px/)
    expect(body).toMatch(/margin:\s*0/)
    expect(body).toMatch(/line-height:\s*1\.4/)
    const input = ruleBody('.pap-consult-privacy__check input')
    expect(input).toMatch(/width:\s*18px/)
    expect(input).toMatch(/height:\s*18px/)
    expect(input).toMatch(/flex:\s*0 0 18px/)
    for (const b of [body, input]) {
      expect(b).not.toMatch(/translate|transform|top:\s*-|margin-top:\s*-|!important/)
    }
  })
})

describe('§3 action-section / hashtag-section split (shared public view SSOT)', () => {
  const variants = ['public', 'preview'] as const

  function hero(theme: (typeof ADVISOR_PROFILE_THEMES)[number], variant: (typeof variants)[number], tags = MODEL.publicTags) {
    const root = parse(
      renderToStaticMarkup(
        <AdvisorPublicProfileView theme={theme} model={{ ...MODEL, publicTags: tags }} slug="hong" variant={variant} />,
      ),
    )
    return root.querySelector('header.pap-hero') as HTMLElement
  }

  it.each(ADVISOR_PROFILE_THEMES.flatMap((t) => variants.map((v) => [t, v] as const)))(
    '%s / %s: actions and hashtags are separate sibling blocks, actions first',
    (theme, variant) => {
      const h = hero(theme, variant)
      const blocks = Array.from(h.children).map((c) => c.classList[0])
      const a = blocks.indexOf('pap-action-section')
      const t = blocks.indexOf('pap-hashtag-section')
      expect(a).toBeGreaterThan(-1)
      expect(t).toBe(a + 1)
      expect(t).toBe(blocks.length - 1)
      const action = h.children[a]
      expect(action.querySelector('.pap-action-bar')).not.toBeNull()
      expect(action.querySelector('.pap-tag')).toBeNull()
      const items = action.querySelectorAll('.pap-action-bar__item')
      expect(Array.from(items).map((i) => i.querySelector('.pap-action-bar__label')?.textContent)).toEqual([
        '전화',
        '상담',
        '명함',
        '공유',
      ])
      const tagText = Array.from(h.children[t].querySelectorAll('.pap-tag')).map((x) => x.textContent)
      expect(tagText).toEqual(MODEL.publicTags.map((x) => `#${x}`))
      // 태그는 히어로 본문/액션 블록 안에 중복 렌더되지 않는다
      expect(h.querySelectorAll('.pap-tag')).toHaveLength(MODEL.publicTags.length)
    },
  )

  it.each(ADVISOR_PROFILE_THEMES)('%s: preview and public render the identical hero markup', (theme) => {
    expect(hero(theme, 'preview').outerHTML).toBe(hero(theme, 'public').outerHTML)
  })

  it.each(ADVISOR_PROFILE_THEMES)('%s: no hashtag block when there are no tags', (theme) => {
    const h = hero(theme, 'public', [])
    expect(h.querySelector('.pap-hashtag-section')).toBeNull()
    expect(h.querySelector('.pap-action-section .pap-action-bar')).not.toBeNull()
  })

  it('CSS: hashtag block has its own padding; action items share top alignment and a single label line', () => {
    expect(ruleBody('.pap-hashtag-section')).toMatch(/padding:\s*10px 16px 12px/)
    expect(ruleBody('.pap-tags--hero')).toMatch(/margin:\s*0/)
    const bar = ruleBody('.pap-action-bar')
    expect(bar).toMatch(/grid-auto-columns:\s*minmax\(0,\s*1fr\)/)
    expect(bar).toMatch(/align-items:\s*start/)
    expect(ruleBody('.pap-action-bar__item')).toMatch(/justify-content:\s*flex-start/)
    expect(ruleBody('.pap-action-bar__label')).toMatch(/white-space:\s*nowrap/)
    expect(css).not.toContain('.pap-hero-premium__tags')
  })
})

describe('§4 theme buttons 1형/2형/3형', () => {
  it('segments are min 76px wide and 44px tall, group 3×76+2 = 230px (within 220–250), not full width', () => {
    const group = ruleBody('.pap-theme-picker')
    const min = Number(group.match(/--pap-theme-segment-min-width:\s*(\d+)px/)?.[1])
    expect(min).toBeGreaterThanOrEqual(68)
    expect(min).toBeLessThanOrEqual(76)
    expect(min * 3 + 2).toBeGreaterThanOrEqual(220)
    expect(min * 3 + 2).toBeLessThanOrEqual(250)
    expect(group).toMatch(/width:\s*max-content/)
    expect(group).toMatch(/grid-template-columns:\s*repeat\(3,\s*1fr\)/)
    const seg = ruleBody('.pap-theme-picker__segment')
    expect(seg).toMatch(/min-width:\s*var\(--pap-theme-segment-min-width\)/)
    expect(seg).toMatch(/height:\s*44px/)
    expect(seg).toMatch(/white-space:\s*nowrap/)
  })

  it('keeps one clearly selected segment and the stored enums', () => {
    for (const theme of ADVISOR_PROFILE_THEMES) {
      const root = parse(renderToStaticMarkup(<AdvisorMobileCardThemePicker value={theme} onChange={() => {}} />))
      const selected = root.querySelectorAll('.pap-theme-picker__segment--selected')
      expect(selected).toHaveLength(1)
      expect(selected[0].getAttribute('aria-checked')).toBe('true')
    }
    expect(ADVISOR_PROFILE_THEMES).toEqual(['classic', 'brand', 'premium'])
  })
})

describe('§5 공개 ON/OFF label follows published state', () => {
  it('maps published state to the label', () => {
    expect(advisorPublishToggleLabel(true)).toBe('공개 ON')
    expect(advisorPublishToggleLabel(false)).toBe('공개 OFF')
  })

  it('the editor toggle renders the label from isPublished (same state the checkbox, save and reload use)', () => {
    expect(pageSource).toMatch(
      /<input type="checkbox" checked=\{isPublished\}[^\n]*\/>\s*<span className="pap-editor-toggle__label">\{advisorPublishToggleLabel\(isPublished\)\}<\/span>/,
    )
    expect(pageSource).not.toMatch(/>\s*공개 ON\s*</)
    expect(pageSource).toMatch(/setIsPublished\(Boolean\(p\.is_published\)\)/)
    expect(pageSource).toMatch(/is_published: isPublished/)
  })
})
