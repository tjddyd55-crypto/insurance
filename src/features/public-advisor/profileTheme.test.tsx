/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AdvisorMobileCardThemePicker } from './components/AdvisorMobileCardThemePicker'
import {
  ADVISOR_PROFILE_THEME_LABELS,
  ADVISOR_PROFILE_THEMES,
  type AdvisorProfileTheme,
} from './profileTheme'

describe('mobile card theme labels', () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  it('maps classic, brand, premium to 1형, 2형, 3형', () => {
    expect(ADVISOR_PROFILE_THEMES).toEqual(['classic', 'brand', 'premium'])
    expect(ADVISOR_PROFILE_THEMES.map((theme) => ADVISOR_PROFILE_THEME_LABELS[theme])).toEqual([
      '1형',
      '2형',
      '3형',
    ])
  })

  it('renders equal segmented buttons without english names or gradient previews', () => {
    const html = renderToStaticMarkup(
      <AdvisorMobileCardThemePicker value="brand" onChange={vi.fn()} />,
    )
    expect(html).toContain('1형')
    expect(html).toContain('2형')
    expect(html).toContain('3형')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('pap-theme-picker__segment--selected')
    expect(html).not.toMatch(/Classic|Brand|Premium|기본형|브랜드형|프리미엄형/)
    expect(html).not.toContain('pap-theme-picker__thumb')
    expect(html).not.toContain('pap-theme-mini')
    const buttons = html.match(/role="radio"/g) ?? []
    expect(buttons).toHaveLength(3)
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'public-advisor.css'), 'utf8')
    expect(css).toMatch(/\.pap-theme-picker\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
    expect(css).toMatch(/\.pap-theme-picker__segment\s*\{[^}]*min-height:\s*44px/)
    expect(css).not.toMatch(/\.pap-theme-picker__thumb/)
  })

  it('keeps the stored enum when a segment is selected', () => {
    const seen: AdvisorProfileTheme[] = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    act(() => {
      root.render(
        <AdvisorMobileCardThemePicker
          value="classic"
          onChange={(theme) => {
            seen.push(theme)
          }}
        />,
      )
    })
    const buttons = [...host.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual(['1형', '2형', '3형'])
    act(() => {
      buttons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(seen).toEqual(['premium'])
    act(() => {
      root.unmount()
    })
    host.remove()
  })
})
