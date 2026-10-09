import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const pcLayoutSource = readFileSync(
  join(dir, '../../pages/workspace/CustomerWorkspaceLayoutPC.tsx'),
  'utf8',
)
const shellCss = readFileSync(join(dir, 'CustomerWorkspacePageShell.css'), 'utf8')

describe('Customer workspace page tabs shell', () => {
  it('uses shared page shell instead of underline FormButton tabs', () => {
    expect(pcLayoutSource).toContain('CustomerWorkspacePageShell')
    expect(pcLayoutSource).not.toContain('customer-workspace-layout__tab--active')
    expect(pcLayoutSource).toContain('customer-workspace-layout__right--page-tabs')
  })

  it('styles active tab as folder index connected to the body panel', () => {
    expect(shellCss).toContain('.customer-workspace-page__tab--active')
    expect(shellCss).toContain('.customer-workspace-page__tabs')
    expect(shellCss).not.toContain('.customer-workspace-page__tabs::after')
    expect(shellCss).toContain('--ws-page-gutter')
    expect(shellCss).toMatch(/\.customer-workspace-page__body::before[\s\S]*height:\s*1px/)
    expect(shellCss).toMatch(
      /\.customer-workspace-page__tab--active::after[\s\S]*customer-workspace-page-surface/,
    )
    expect(shellCss).toMatch(/\.customer-workspace-page__tab--active[\s\S]*border-bottom:\s*none/)
    expect(shellCss).toContain('--ws-tab-lift')
    expect(shellCss).toMatch(/--ws-active-height:\s*48px/)
    expect(shellCss).toMatch(/\.customer-workspace-page__body[\s\S]*border:\s*1px solid/)
    expect(shellCss).toContain('.customer-workspace-page__body')
  })
})
