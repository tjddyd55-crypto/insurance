import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../index.css'),
  'utf8',
)

describe('customer-list-scroll-top-button CSS scope', () => {
  it('excludes scroll FAB from mobile global button height reset', () => {
    expect(indexCss).toMatch(/:not\(\.customer-list-scroll-top-button\)/)
  })

  it('defines mobile modifier on the button itself', () => {
    expect(indexCss).toMatch(/\.customer-list-scroll-top-button--mobile\s*\{/)
    expect(indexCss).toMatch(/\.customer-list-scroll-top-button__icon\s*\{/)
  })
})
