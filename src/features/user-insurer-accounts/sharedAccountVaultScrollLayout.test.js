import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8')

/**
 * 공개 공유 계정관리 레이아웃 계약:
 * /share/account-credentials/* 는 document 세로 스크롤을 쓰고,
 * 인증 셸의 100vh+overflow:hidden 조합에 잠기지 않아야 한다.
 */
describe('shared account vault public scroll layout contract', () => {
  it('scopes document-scroll unlock to app-root--external-account-vault', () => {
    assert.match(indexCss, /\.app-root\.app-root--external-account-vault\s*\{/)
    assert.match(indexCss, /html:has\(\.app-root--external-account-vault\)/)
    assert.match(indexCss, /body:has\(\.app-root--external-account-vault\)/)
  })

  it('allows vertical document scroll and blocks horizontal overflow on public share shell', () => {
    assert.match(
      indexCss,
      /html:has\(\.app-root--external-account-vault\),\s*body:has\(\.app-root--external-account-vault\)\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;/,
    )
    assert.match(
      indexCss,
      /\.app-root\.app-root--external-account-vault\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/,
    )
  })

  it('overrides authenticated viewport lock for the share route', () => {
    assert.match(
      indexCss,
      /\.app-root\.app-root--authenticated\.app-root--external-account-vault\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/,
    )
    assert.match(
      indexCss,
      /\.app-root\.app-root--authenticated\.app-root--external-account-vault\s+\.main-container\s*\{[\s\S]*?overflow:\s*visible;/,
    )
  })

  it('lets shared page content grow instead of fixed 100% height clip', () => {
    assert.match(
      indexCss,
      /\.app-root\.app-root--external-account-vault\s+\.shared-account-workspace-page\.content-wrapper\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*visible;[\s\S]*?padding-bottom:\s*max\(24px/,
    )
  })

  it('does not introduce dual scroll via 100vh+overflow:hidden on the share shell', () => {
    const shellBlock = indexCss.match(
      /\.app-root\.app-root--external-account-vault\s*\{[^}]+\}/,
    )
    assert.ok(shellBlock, 'external-account-vault shell block missing')
    assert.doesNotMatch(shellBlock[0], /overflow:\s*hidden/)
    assert.doesNotMatch(shellBlock[0], /max-height:\s*100/)
  })
})
