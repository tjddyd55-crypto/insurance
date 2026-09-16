import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('StorageExplorerFileActionsMenu', () => {
  const menu = read('features/storage/components/StorageExplorerFileActionsMenu.tsx')
  const panel = read('features/storage/components/StorageExplorerFilePanel.tsx')
  const css = read('index.css')

  it('renders compact actions through a body portal floating menu', () => {
    expect(menu).toMatch(/createPortal/)
    expect(menu).toMatch(/document\.body/)
    expect(menu).toMatch(/aria-haspopup="menu"/)
    expect(menu).toMatch(/role="menu"/)
    expect(menu).toMatch(/event\.key === 'Escape'/)
    expect(menu).toMatch(/addEventListener\('mousedown'/)
    expect(css).toMatch(/storage-explorer-files__actions-menu-panel--floating/)
    expect(css).toMatch(/z-index:\s*850/)
  })

  it('keeps one-open menu state in the file panel', () => {
    expect(panel).toMatch(/openActionMenuFileId/)
    expect(panel).toMatch(/StorageExplorerFileActionsMenu/)
    expect(panel).not.toMatch(/<details className="storage-explorer-files__actions-menu"/)
  })
})
