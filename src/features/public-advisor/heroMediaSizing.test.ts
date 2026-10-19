import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'public-advisor.css'), 'utf8')

function ruleBody(selector: string): string {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('hero media sizing SSOT', () => {
  it('sizes classic and premium from aspect-ratio, not viewport height', () => {
    const classic = ruleBody('.pap-hero--theme-classic .pap-hero-photo-wrap {')
    const premium = ruleBody('.pap-hero--theme-premium .pap-hero-premium__media {')
    expect(classic).toContain('aspect-ratio: 4 / 5')
    expect(classic).not.toMatch(/max-height/)
    expect(classic).not.toMatch(/vh/)
    expect(premium).toContain('aspect-ratio: 2 / 3')
    expect(premium).not.toMatch(/max-height/)
    expect(premium).not.toMatch(/vh/)
    expect(css).not.toMatch(/pap-hero-photo-wrap\s*\{[^}]*max-height/)
    expect(css).not.toMatch(/pap-hero-premium__media\s*\{[^}]*max-height/)
    expect(css).not.toMatch(/min\(50vh|min\(52vh|min\(56vh|min\(58vh|min\(72vh/)
  })

  it('sizes the brand ring from the card container, not the viewport', () => {
    const ring = ruleBody('.pap-hero-brand__photo-ring {')
    expect(ring).toContain('width: min(52cqw, 196px)')
    expect(ring).toContain('height: min(52cqw, 196px)')
    expect(ring).toContain('aspect-ratio: 1')
    expect(css).not.toMatch(/52vw/)
  })

  it('keeps one object-fit and object-position per theme', () => {
    expect(css).toContain('object-position: center 18%')
    expect(css).toContain('object-position: center 15%')
    expect(css).toContain('object-position: center 12%')
    expect(css).not.toMatch(/pap-public-profile-view--in-editor-preview[^{]*\{[^}]*object-fit/)
    expect(css).not.toMatch(/pap-page--fc \.pap-hero--theme-premium \.pap-hero-premium__media\s*\{[^}]*aspect-ratio/)
  })

  it('makes the fc shell fill the card container, not the viewport max-width', () => {
    const shell = ruleBody('.pap-page--fc .public-advisor-shell.pap-shell--fc {')
    expect(shell).toContain('width: 100%')
    expect(shell).toContain('max-width: none')
    expect(shell).toMatch(/margin:\s*0\s*;/)
    expect(css).not.toMatch(/\.pap-public-profile-view--in-editor-preview \.public-advisor-shell/)
    expect(css).not.toMatch(/pap-editor-live-preview__frame--phone[\s\S]{0,400}transform:\s*scale/)
    const viewport = ruleBody('.pap-editor-live-preview__scroll--phone {')
    expect(viewport).toContain('width: var(--pap-preview-viewport)')
    expect(viewport).toContain('max-width: none')
    expect(viewport).toContain('padding: 0')
    expect(viewport).toContain('border: 0')
  })
})
