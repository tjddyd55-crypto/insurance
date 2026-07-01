import { escapeHtmlAttr } from './customerInviteRegistrationPublic.js'

export const ACCOUNT_VAULT_SHARE_PAGE_DESCRIPTION = '보험사 계정관리 페이지입니다.'

/**
 * @param {string | null | undefined} ownerDisplayName
 */
export function buildAccountVaultSharePageTitle(ownerDisplayName) {
  const name = String(ownerDisplayName ?? '').trim() || '사용자'
  return `${name} 계정관리`
}

/**
 * dist index.html 에 외부 계정관리 share 링크용 title / description / og / twitter 삽입 (크롤러용).
 *
 * @param {string} html
 * @param {string | null | undefined} ownerDisplayName valid token owner only
 */
export function injectAccountVaultShareMeta(html, ownerDisplayName) {
  const resolvedName = String(ownerDisplayName ?? '').trim()
  if (!resolvedName) {
    return String(html)
  }

  const title = buildAccountVaultSharePageTitle(resolvedName)
  const desc = ACCOUNT_VAULT_SHARE_PAGE_DESCRIPTION
  const t = escapeHtmlAttr(title)
  const d = escapeHtmlAttr(desc)

  const metaBlock = `
    <meta name="description" content="${d}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
`

  let out = String(html)
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:type["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '')

  out = out.replace(/<head>/i, `<head>${metaBlock}`)
  return out
}
